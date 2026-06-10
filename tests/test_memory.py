"""Unit tests for the adaptive Hebbian memory (vault I/O + graph dynamics + recall).

All deterministic and offline — no Ollama, no network. The LLM extractor is not
exercised here; these cover the pure logic behind it.
"""

from datetime import UTC, datetime, timedelta

from voicebot.memory import MemoryStore, graph, recall, vault
from voicebot.memory.vault import Note

NOW = datetime(2026, 6, 9, 12, 0, 0, tzinfo=UTC)


def _note(nid, ntype="symptom", content="x", aliases=None, links=None, last_active=NOW):
    return Note(
        id=nid,
        type=ntype,
        content=content,
        aliases=aliases or [],
        links=links or {},
        created=last_active.isoformat(),
        updated=last_active.isoformat(),
        last_active=last_active.isoformat(),
        activations=1,
    )


# -- vault round-trip ------------------------------------------------------- #


def test_note_serialize_parse_round_trip():
    note = _note(
        "hot-flashes",
        content="Reports hot flashes at night, three cycles in a row.",
        aliases=["hot flash", "night sweats"],
        links={"menopause-hrt": 0.82, "sleep": 0.45},
    )
    parsed = vault.parse_note(vault.serialize_note(note))
    assert parsed is not None
    assert parsed.id == "hot-flashes"
    assert parsed.type == "symptom"
    assert parsed.aliases == ["hot flash", "night sweats"]
    assert parsed.links == {"menopause-hrt": 0.82, "sleep": 0.45}
    assert "hot flashes at night" in parsed.content
    # the regenerated Related: [[..]] line must not leak into the body
    assert "Related:" not in parsed.content


def test_parse_rejects_text_without_frontmatter():
    assert vault.parse_note("just some text") is None


# -- spreading activation --------------------------------------------------- #


def test_spread_reaches_neighbours_with_damping():
    notes = {
        "a": _note("a", links={"b": 0.5}),
        "b": _note("b", links={"a": 0.5, "c": 0.5}),
        "c": _note("c", links={"b": 0.5}),
    }
    act = graph.spread(notes, ["a"], hops=2, decay=0.6)
    assert act["a"] >= 1.0  # seed, plus a little back-flow on the second hop
    assert abs(act["b"] - 0.3) < 1e-9  # 1.0 * 0.5 * 0.6
    assert abs(act["c"] - 0.09) < 1e-9  # two hops: 0.3 * 0.5 * 0.6
    assert act["c"] < act["b"]  # weaker the further it spreads


def test_spread_with_no_seeds_is_empty():
    notes = {"a": _note("a")}
    assert graph.spread(notes, [], hops=2, decay=0.6) == {}


# -- Hebbian reinforcement -------------------------------------------------- #


def test_reinforce_creates_and_grows_symmetric_edges():
    notes = {"a": _note("a"), "b": _note("b")}
    graph.reinforce(notes, ["a", "b"], eta=0.3)
    assert notes["a"].links["b"] == 0.3  # 0 + 0.3 * (1 - 0)
    assert notes["b"].links["a"] == 0.3  # symmetric
    graph.reinforce(notes, ["a", "b"], eta=0.3)
    assert abs(notes["a"].links["b"] - 0.51) < 1e-9  # 0.3 + 0.3 * 0.7


def test_reinforce_stays_within_unit_bound():
    notes = {"a": _note("a"), "b": _note("b")}
    for _ in range(100):
        graph.reinforce(notes, ["a", "b"], eta=0.5)
    assert notes["a"].links["b"] <= 1.0


# -- decay / forgetting ----------------------------------------------------- #


def test_decay_weakens_stale_edges_and_prunes_below_floor():
    stale = NOW - timedelta(days=60)
    notes = {
        "a": _note("a", links={"b": 0.2}, last_active=stale),
        "b": _note("b", links={"a": 0.2}, last_active=stale),
    }
    graph.decay(notes, NOW, tau_days=30.0, floor=0.05)
    # 0.2 * exp(-60/30) = 0.0271 < 0.05 → pruned both ways
    assert "b" not in notes["a"].links
    assert "a" not in notes["b"].links


def test_decay_keeps_recent_edges_intact():
    notes = {
        "a": _note("a", links={"b": 0.5}, last_active=NOW),
        "b": _note("b", links={"a": 0.5}, last_active=NOW),
    }
    graph.decay(notes, NOW, tau_days=30.0, floor=0.05)
    assert abs(notes["a"].links["b"] - 0.5) < 1e-9  # Δt ≈ 0 → factor ≈ 1


# -- recall ----------------------------------------------------------------- #


def test_recall_seeds_on_alias_and_includes_profile_and_neighbours():
    notes = {
        "hot-flashes": _note("hot-flashes", aliases=["night sweats"], links={"sleep": 0.5}),
        "sleep": _note("sleep", content="Sleep has been poor."),
        "menopause-hrt": _note("menopause-hrt", ntype="therapy", content="On menopause HRT."),
    }
    block, active = recall.recall(
        notes, "I had night sweats again", top_k=5, hops=2, spread_decay=0.6
    )
    assert "hot-flashes" in active  # fired by the alias
    assert "sleep" in active  # reached via spreading activation
    assert "On menopause HRT." in block  # therapy profile always shown
    assert "menopause-hrt" not in active  # profile does not co-activate


def test_recall_without_a_match_returns_only_profile():
    notes = {"menopause-hrt": _note("menopause-hrt", ntype="therapy", content="On menopause HRT.")}
    block, active = recall.recall(
        notes, "what's the weather", top_k=5, hops=2, spread_decay=0.6
    )
    assert active == []
    assert "On menopause HRT." in block


# -- knowledge base separation + wipe safety -------------------------------- #


def _reference(nid, content, aliases):
    return _note(nid, ntype="reference", content=content, aliases=aliases)


def test_recall_fires_admin_knowledge_on_lexical_match(tmp_path):
    personal = {"sleep": _reference("sleep", "Sleep has been poor.", ["sleep"])}
    knowledge = {
        "estrogen-follicular": _reference(
            "estrogen-follicular",
            "Estrogen rises through the follicular phase.",
            ["estrogen", "follicular phase"],
        )
    }
    store = MemoryStore(tmp_path, personal, knowledge)
    block, active = store.recall("tell me about the follicular phase")
    assert "estrogen-follicular" in active  # admin note fired by its alias
    assert "Estrogen rises through the follicular phase." in block


def test_wipe_clears_personal_vault_but_keeps_knowledge(tmp_path):
    # A personal note exists on disk; the knowledge base lives elsewhere.
    personal_note = _note("hot-flashes", content="Reports hot flashes.")
    vault.write_note(tmp_path, personal_note)
    knowledge = {
        "estrogen-follicular": _reference("estrogen-follicular", "Estrogen rises.", ["estrogen"])
    }
    store = MemoryStore(tmp_path, {"hot-flashes": personal_note}, knowledge)

    store.wipe()

    # Personal note gone from memory and from disk...
    assert list(tmp_path.glob("*.md")) == []
    # ...but the admin knowledge survives and still answers.
    _, active = store.recall("what about estrogen")
    assert "estrogen-follicular" in active
