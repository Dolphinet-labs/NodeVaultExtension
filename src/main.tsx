import "lib/env/shim";

import { porter } from "core/client";
import { PorterChannel } from "core/types";

import { mount } from "app/root";
import MainApp from "app/components/MainApp";
import { initProfiles } from "lib/ext/profile";
import { setupFixtures } from "core/repo";

(async () => {
  await initProfiles();
  await setupFixtures();

  porter.connect(PorterChannel.Wallet);
  mount(<MainApp />);
})();
