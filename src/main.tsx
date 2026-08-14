import "lib/env/shim";

import { porter } from "core/client";
import { PorterChannel } from "core/types";
import { sleepOnInactivity } from "lib/ext/sleepOnInactivity";

import { mount } from "app/root";
import MainApp from "app/components/MainApp";
import { initProfiles } from "lib/ext/profile";
import { setupFixtures } from "core/repo";

(async () => {
  await initProfiles();
  await setupFixtures();

  porter.connect(PorterChannel.Wallet);
  let unmount: (() => void) | null = mount(<MainApp />);

  sleepOnInactivity({
    onSleep() {
      porter.suspend();
      unmount?.();
      unmount = null;
    },
    onWake() {
      porter.resume(PorterChannel.Wallet);
      unmount = mount(<MainApp />);
    },
  });
})();
