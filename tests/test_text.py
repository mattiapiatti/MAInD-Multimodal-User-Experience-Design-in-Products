"""Unit tests for the streaming sentence-chunking utilities."""

from voicebot.text import flush_long, split_sentences


def test_splits_complete_sentences_and_keeps_remainder():
    sentences, remainder = split_sentences("Take the night bus. It is cheaper. Then")
    assert sentences == ["Take the night bus.", "It is cheaper."]
    assert remainder == " Then"


def test_no_complete_sentence_yet():
    sentences, remainder = split_sentences("This is stressful")
    assert sentences == []
    assert remainder == "This is stressful"


def test_does_not_split_on_decimals_or_times():
    sentences, remainder = split_sentences("The fare is 3.50 and the bus leaves at 9.30")
    assert sentences == []
    assert remainder == "The fare is 3.50 and the bus leaves at 9.30"


def test_handles_question_and_exclamation():
    sentences, remainder = split_sentences("Are you safe? Stay where you are! ")
    assert sentences == ["Are you safe?", "Stay where you are!"]
    assert remainder.strip() == ""


def test_flush_long_breaks_at_space():
    long = "word " * 50  # 250 chars, no sentence punctuation
    chunk, remainder = flush_long(long.strip())
    assert chunk is not None
    assert len(chunk) <= 180
    assert chunk and remainder
    assert " " not in remainder[:1]  # remainder left-stripped


def test_flush_long_keeps_short_text():
    chunk, remainder = flush_long("still short")
    assert chunk is None
    assert remainder == "still short"
