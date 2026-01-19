import "lib/env/shim";

import { porter } from "core/client";
import { PorterChannel } from "core/types";

import { mount } from "app/root";
import PopupApp from "app/components/PopupApp";
import { initProfiles } from "lib/ext/profile";
import { setupFixtures } from "core/repo";

(async () => {
  // Ensure profile-scoped DB keys are available before touching Dexie/fixtures.
  await initProfiles();
  await setupFixtures();

  porter.connect(PorterChannel.Wallet);
  mount(<PopupApp />);
})();
