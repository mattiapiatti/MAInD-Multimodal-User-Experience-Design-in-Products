import journal from './meta/_journal.json';
import m0000 from './0000_cloudy_human_cannonball.sql';
import m0001 from './0001_reverse_pairing.sql';
import m0002 from './0002_pairing_secret.sql';

  export default {
    journal,
    migrations: {
      m0000,
      m0001,
      m0002
    }
  }
