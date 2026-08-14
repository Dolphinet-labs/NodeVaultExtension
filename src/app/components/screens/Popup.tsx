import {
  FC,
  ReactNode,
  memo,
  Suspense,
  useCallback,
  useState,
  useMemo,
  useEffect,
  PropsWithChildren,
} from "react";
import { useAtomValue } from "jotai";
import classNames from "clsx";
import { match } from "ts-pattern";
import { PopupToolbarTab } from "app/nav";
import Masonry from "lib/react-masonry/Masonry";
import { useAtomsAll, useLazyAtomValue } from "lib/atom-utils";

import {
  Account,
  AccountAsset,
  AccountNFT,
  TokenStatus,
  TokenType,
  WalletStatus,
} from "core/types";
import * as repo from "core/repo";

import {
  LOAD_MORE_ON_TOKEN_FROM_END,
  LOAD_MORE_ON_NFT_FROM_END,
} from "app/defaults";
import {
  activeTabAtom,
  getPermissionAtom,
  getTabOrigin,
  isSidePanelEnabledAtom,
  popupToolbarTabAtom,
  tokenTypeAtom,
  walletStateAtom,
  web3MetaMaskCompatibleAtom,
} from "app/atoms";
import { useAccountToken, useIsSyncing, useLazyNetwork } from "app/hooks";
import { useNftBatchRedeem } from "app/hooks/nftBatchRedeem";
import { useTokenList } from "app/hooks/tokenList";

import PopupLayout from "../layouts/PopupLayout";
import PreloadBaseAndSync from "../layouts/PreloadBaseAndSync";
import SecondaryModal, {
  SecondaryModalProps,
} from "../elements/SecondaryModal";
import AssetCard from "../blocks/popup/AssetCard";
import NullState from "../blocks/tokenList/NullState";
import NoNftState from "../blocks/tokenList/NoNftState";
import NftCard from "../blocks/tokenList/NftCard";
import ActivityContent from "../blocks/activity/ActivityContent";
import NFTOverviewPopup from "../blocks/popup/NFTOverviewPopup";
import RedeemModal from "../blocks/redeem/RedeemModal";
import BatchRedeemBar from "../blocks/redeem/BatchRedeemBar";

import ShareAddress from "./receiveTabs/ShareAddress";
import AssetsManagement, { ManageMode } from "../elements/AssetsManagement";
import NetworksButton from "../blocks/NetworksButton";
import NetworkIcon from "../elements/NetworkIcon";
import { NATIVE_TOKEN_SLUG } from "core/common";
import FiatAmount from "../elements/FiatAmount";

const Popup: FC = () => {
  const tab = useAtomValue(popupToolbarTabAtom);

  return (
    <PreloadAndSync>
      <PopupLayout>{matchPopupTabs(tab) as unknown as ReactNode}</PopupLayout>
    </PreloadAndSync>
  );
};

export default Popup;

const Assets: FC = () => {
  const { walletStatus } = useAtomValue(walletStateAtom);
  const tokenType = useAtomValue(tokenTypeAtom);
  const isUnlocked = walletStatus === WalletStatus.Unlocked;

  return isUnlocked ? (
    <>
      <PopupNetworkSelect />
      <TokenList key={tokenType} />
    </>
  ) : null;
};

const Activities: FC = () => {
  const { walletStatus } = useAtomValue(walletStateAtom);
  const isUnlocked = walletStatus === WalletStatus.Unlocked;

  return isUnlocked ? (
    <Suspense fallback={null}>
      <ActivityContent />
    </Suspense>
  ) : null;
};

const PreloadAndSync: FC<PropsWithChildren> = ({ children }) => {
  useAtomsAll([web3MetaMaskCompatibleAtom, isSidePanelEnabledAtom]);

  const tab = useAtomValue(activeTabAtom);
  const tabOrigin = getTabOrigin(tab);

  const permission = useLazyAtomValue(getPermissionAtom(tabOrigin), "off");

  return (
    <PreloadBaseAndSync chainId={permission?.chainId}>
      {children}
    </PreloadBaseAndSync>
  );
};

const PopupNetworkSelect: FC = () => {
  const activeTab = useAtomValue(activeTabAtom);
  const tabOrigin = getTabOrigin(activeTab);
  const isSyncing = useIsSyncing();
  const currentNetwork = useLazyNetwork();

  const nativeToken = useAccountToken(NATIVE_TOKEN_SLUG);

  const handleChange = useCallback(
    (chainId: number) => {
      if (!tabOrigin) return;

      repo.permissions
        .where({ origin: tabOrigin })
        .modify((perm) => {
          perm.chainId = chainId;
        })
        .catch(console.error);
    },
    [tabOrigin],
  );

  return (
    <NetworksButton className="max-w-auto" size="small" onChange={handleChange}>
      {currentNetwork ? (
        <>
          <NetworkIcon
            network={currentNetwork}
            className={classNames("w-8 h-8 mr-3", isSyncing && "animate-pulse")}
          />

          <span className="min-w-0 truncate mr-auto">
            {currentNetwork.name}
          </span>

          {nativeToken?.portfolioUSD && (
            <FiatAmount
              amount={nativeToken?.portfolioUSD}
              copiable={false}
              className={classNames(
                "ml-auto mr-2 pl-2 text-base font-bold text-brand-light",
              )}
            />
          )}
        </>
      ) : (
        <div className="h-8" />
      )}
    </NetworksButton>
  );
};

const TokenList: FC = () => {
  const tokenType = useAtomValue(tokenTypeAtom);

  const {
    searchValue,
    setSearchValue,
    searchInputRef,
    tokens: tokensPure,
    loadMoreTriggerRef,
    manageModeEnabled,
    setManageModeEnabled,
    tokenIdSearchValue,
    setTokenIdSearchValue,
    tokenIdSearchInputRef,
    tokenIdSearchDisplayed,
    focusSearchInput,
    currentAccount,
    isNftsSelected,
    syncing,
    searching,
    searchValueIsAddress,
  } = useTokenList(tokenType, {
    searchPersist: tokenType === TokenType.NFT,
  });

  const [mode, setMode] = useState<ManageMode>(null);

  const tokens = useMemo(
    () => (mode === "add" && !searchValueIsAddress ? [] : tokensPure),
    [mode, searchValueIsAddress, tokensPure],
  );

  const {
    multiSelectEnabled,
    toggleMultiSelect,
    selectedSlugSet,
    selectedTokens,
    redeemTokens,
    redeemDisabledSlugs,
    toggleSelect,
    batchRedeemOpened,
    setBatchRedeemOpened,
  } = useNftBatchRedeem({
    tokens,
    isNftsSelected,
    suspended: manageModeEnabled || mode !== null,
  });

  const tokensBar = useMemo(() => {
    if (tokens.length === 0) {
      if (searchValue) {
        return (
          <NullState
            searching={searching}
            focusSearchInput={focusSearchInput}
          />
        );
      } else if (isNftsSelected) {
        return <NoNftState syncing={syncing} className="-mt-2" />;
      }
    } else {
      return !isNftsSelected ? (
        <AssetList
          tokens={tokens as AccountAsset[]}
          manageModeEnabled={manageModeEnabled}
          loadMoreTriggerRef={loadMoreTriggerRef}
        />
      ) : (
        <NftList
          tokens={tokens as AccountNFT[]}
          currentAccount={currentAccount}
          manageModeEnabled={manageModeEnabled}
          loadMoreTriggerRef={loadMoreTriggerRef}
          multiSelectEnabled={multiSelectEnabled}
          selectedSlugSet={selectedSlugSet}
          redeemDisabledSlugs={redeemDisabledSlugs}
          onToggleSelect={toggleSelect}
        />
      );
    }

    return null;
  }, [
    currentAccount,
    focusSearchInput,
    isNftsSelected,
    loadMoreTriggerRef,
    manageModeEnabled,
    multiSelectEnabled,
    toggleSelect,
    searchValue,
    searching,
    redeemDisabledSlugs,
    selectedSlugSet,
    syncing,
    tokens,
  ]);

  return (
    <>
      <AssetsManagement
        size="small"
        manageModeEnabled={manageModeEnabled}
        setManageModeEnabled={setManageModeEnabled}
        searchInputRef={searchInputRef}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        tokenIdSearchValue={tokenIdSearchValue}
        setTokenIdSearchValue={setTokenIdSearchValue}
        tokenIdSearchInputRef={tokenIdSearchInputRef}
        tokenIdSearchDisplayed={tokenIdSearchDisplayed}
        mode={mode}
        onModeChange={setMode}
        className="my-3"
      />
      {isNftsSelected && mode === null && !manageModeEnabled && (
        <BatchRedeemBar
          className="mb-2"
          multiSelectEnabled={multiSelectEnabled}
          selectedCount={selectedTokens.length}
          onToggleMultiSelect={toggleMultiSelect}
          onRedeem={() => setBatchRedeemOpened(true)}
        />
      )}
      {tokensBar}
      {multiSelectEnabled && redeemTokens.length > 0 && (
        <RedeemModal
          open={batchRedeemOpened}
          onOpenChange={setBatchRedeemOpened}
          tokens={redeemTokens}
        />
      )}
    </>
  );
};

type AssetListProps = {
  tokens: AccountAsset[];
  manageModeEnabled: boolean;
  loadMoreTriggerRef: (node: any) => void;
};

const AssetList = memo<AssetListProps>(
  ({ tokens, manageModeEnabled, loadMoreTriggerRef }) => {
    const [receivePopupOpened, setReceivePopupOpened] = useState(false);

    return (
      <>
        {tokens.map((asset, i) => (
          <AssetCard
            key={asset.tokenSlug}
            ref={
              i === tokens.length - LOAD_MORE_ON_TOKEN_FROM_END - 1
                ? loadMoreTriggerRef
                : null
            }
            asset={asset as AccountAsset}
            isManageMode={manageModeEnabled}
            className={classNames(i !== tokens.length - 1 && "mb-1")}
          />
        ))}

        <ReceivePopup
          open={receivePopupOpened}
          onOpenChange={setReceivePopupOpened}
        />
      </>
    );
  },
);

type NftListProps = {
  tokens: AccountNFT[];
  currentAccount: Account;
  manageModeEnabled: boolean;
  loadMoreTriggerRef: (node: any) => void;
  multiSelectEnabled: boolean;
  selectedSlugSet: Set<string>;
  redeemDisabledSlugs: Set<string>;
  onToggleSelect: (tokenSlug: string) => void;
};

const NftList = memo<NftListProps>(
  ({
    currentAccount,
    tokens,
    manageModeEnabled,
    loadMoreTriggerRef,
    multiSelectEnabled,
    selectedSlugSet,
    redeemDisabledSlugs,
    onToggleSelect,
  }) => {
    const [nftToken, setNftToken] = useState<AccountNFT | undefined>();

    const handleNFTSelect = useCallback(
      async (token: AccountNFT) => {
        if (manageModeEnabled) {
          try {
            await repo.accountTokens.put(
              {
                ...token,
                status:
                  token.status === TokenStatus.Enabled
                    ? TokenStatus.Disabled
                    : TokenStatus.Enabled,
              },
              [token.chainId, currentAccount.address, token.tokenSlug].join(
                "_",
              ),
            );
          } catch (e) {
            console.error(e);
          }
        } else if (multiSelectEnabled) {
          if (redeemDisabledSlugs.has(token.tokenSlug)) return;
          onToggleSelect(token.tokenSlug);
        } else {
          setNftToken(token);
        }
      },
      [
        manageModeEnabled,
        currentAccount.address,
        setNftToken,
        multiSelectEnabled,
        redeemDisabledSlugs,
        onToggleSelect,
      ],
    );

    useEffect(() => {
      setNftToken((current) => {
        if (!current) return current;

        const updated = tokens.find((t) => t.tokenSlug === current.tokenSlug);

        return updated ?? current;
      });
    }, [tokens, setNftToken]);

    const renderNFTCard = useCallback(
      (nft: AccountNFT, i: number) => (
        <NftCard
          key={nft.tokenSlug}
          ref={
            i === tokens.length - LOAD_MORE_ON_NFT_FROM_END - 1
              ? loadMoreTriggerRef
              : null
          }
          nft={nft}
          isMultiSelect={multiSelectEnabled}
          isSelected={selectedSlugSet.has(nft.tokenSlug)}
          isRedeemDisabled={redeemDisabledSlugs.has(nft.tokenSlug)}
          onSelect={handleNFTSelect}
          isManageMode={manageModeEnabled}
        />
      ),
      [
        tokens.length,
        manageModeEnabled,
        handleNFTSelect,
        loadMoreTriggerRef,
        multiSelectEnabled,
        redeemDisabledSlugs,
        selectedSlugSet,
      ],
    );

    return (
      <>
        <Masonry items={tokens} renderItem={renderNFTCard} gap="0.25rem" />

        <NFTOverviewPopup
          open={Boolean(nftToken)}
          token={nftToken}
          onOpenChange={() => setNftToken(undefined)}
        />
      </>
    );
  },
);

type ReceivePopupProps = Pick<SecondaryModalProps, "open" | "onOpenChange">;

const ReceivePopup: FC<ReceivePopupProps> = (props) => (
  <SecondaryModal {...props} small>
    <ShareAddress />
  </SecondaryModal>
);

const matchPopupTabs = (tab: PopupToolbarTab) => {
  return match<PopupToolbarTab, ReactNode>(tab)
    .with(PopupToolbarTab.Assets, () => <Assets />)
    .with(PopupToolbarTab.Activity, () => <Activities />)
    .otherwise(() => <Assets />);
};
