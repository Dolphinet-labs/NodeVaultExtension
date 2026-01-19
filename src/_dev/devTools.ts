import browser from "webextension-polyfill";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { Buffer } from "buffer";

import * as profile from "lib/ext/profile";
import * as i18n from "lib/ext/i18n";
import { storage } from "lib/ext/storage";
import { globalStorage } from "lib/ext/globalStorage";
import * as clientStorage from "lib/ext/clientStorage";
import * as cryptoUtils from "lib/crypto-utils";
import { downloadFile } from "lib/download";

import * as types from "core/types";
import * as common from "core/common";
import * as repo from "core/repo";
import * as client from "core/client";

import { reset, getAllStorage } from "./utils";

const RELEASE_ENV =
  typeof process !== "undefined" ? process.env.RELEASE_ENV : undefined;
const WIGWAM_DEV_CONTROL_PANEL =
  typeof process !== "undefined"
    ? process.env.WIGWAM_DEV_CONTROL_PANEL
    : undefined;

Object.assign(window, {
  ...cryptoUtils,
  browser,
  ethers,
  Buffer,
  profile,
  storage,
  globalStorage,
  clientStorage,
  i18n,
  types,
  common,
  repo,
  client,
  reset,
  getAllStorage,
  BigNumber,
  downloadFile,
});

if (RELEASE_ENV === "false") {
  const imports = [
    import("./importExport"),
    WIGWAM_DEV_CONTROL_PANEL === "true" && import("./controlPanel"),
  ].filter(Boolean);

  Promise.all(imports)
    .then((modules) => modules.forEach((m) => m && Object.assign(window, m)))
    .catch(console.error);
}
