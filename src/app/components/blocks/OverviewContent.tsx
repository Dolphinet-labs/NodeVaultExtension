import {
  FC,
  memo,
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classNames from "clsx";
import { useAtom, useAtomValue } from "jotai";
import Masonry from "lib/react-masonry/Masonry";
import { t } from "lib/ext/i18n";
import { useI18NUpdate } from "lib/ext/i18n/react";
import { storage } from "lib/ext/storage";

import { AccountAsset, TokenType, AccountToken, AccountNFT } from "core/types";
import {
  NATIVE_TOKEN_SLUG,
  parseTokenSlug,
  toggleTokenStatus,
} from "core/common/tokens";

import {
  LOAD_MORE_ON_NFT_FROM_END,
  LOAD_MORE_ON_TOKEN_FROM_END,
} from "app/defaults";
import { tokenSlugAtom, tokenTypeAtom } from "app/atoms";
import { useAccountToken } from "app/hooks";
import { ToastOverflowProvider } from "app/hooks/toast";
import { useTokenList } from "app/hooks/tokenList";

import ScrollAreaContainer from "../elements/ScrollAreaContainer";
import AssetsManagement, { ManageMode } from "../elements/AssetsManagement";
import Button from "../elements/Button";
import RedeemModal from "../blocks/redeem/RedeemModal";
import NullState from "../blocks/tokenList/NullState";
import NoNftState from "../blocks/tokenList/NoNftState";
import NftCard from "../blocks/tokenList/NftCard";

import AssetCard from "./overview/AssetCard";
import AssetInfo from "./overview/AssetInfo";
import NftInfo from "./overview/NftInfo";

const OverviewContent: FC = () => (
  <div className="flex min-h-0 grow relative">
    <ToastOverflowProvider>
      <TokenExplorer />
    </ToastOverflowProvider>
  </div>
);

export default OverviewContent;

const TokenExplorer: FC = () => {
  const tokenType = useAtomValue(tokenTypeAtom);
  const tokenSlug = useAtomValue(tokenSlugAtom);

  return (
    <>
      <div
        className={classNames(
          "w-[26rem] min-w-[26rem] pr-6 mt-6",
          "border-r border-brand-main/[.07]",
          "flex flex-col",
        )}
      >
        <TokenList key={tokenType} tokenType={tokenType} />
      </div>

      <Suspense fallback={null}>
        {tokenSlug &&
          (tokenType === TokenType.Asset ? <AssetInfo /> : <NftInfo />)}
      </Suspense>
    </>
  );
};

const TokenList = memo<{ tokenType: TokenType }>(({ tokenType }) => {
  useI18NUpdate();
  const [tokenSlug, setTokenSlug] = useAtom(tokenSlugAtom);

  const setDefaultTokenRef = useRef(!tokenSlug);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleAccountTokensReset = useCallback(() => {
    scrollAreaRef.current?.scrollTo(0, 0);

    setDefaultTokenRef.current = true;
  }, []);

  const {
    isNftsSelected,
    searchValue,
    manageModeEnabled,
    tokens: tokensPure,
    syncing,
    searching,
    focusSearchInput,
    loadMoreTriggerRef,

    setManageModeEnabled,
    searchInputRef,
    setSearchValue,
    tokenIdSearchValue,
    setTokenIdSearchValue,
    tokenIdSearchInputRef,
    tokenIdSearchDisplayed,
    searchValueIsAddress,
  } = useTokenList(tokenType, {
    onAccountTokensReset: handleAccountTokensReset,
  });

  const selectedToken = useAccountToken(tokenSlug ?? NATIVE_TOKEN_SLUG);

  const [mode, setMode] = useState<ManageMode>(null);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedTokenSlugs, setSelectedTokenSlugs] = useState<string[]>([]);
  const [batchRedeemOpened, setBatchRedeemOpened] = useState(false);
  const [redeemDisabledSlugs, setRedeemDisabledSlugs] = useState<Set<string>>(
    () => new Set(),
  );

  const tokens = useMemo(
    () => (mode === "add" && !searchValueIsAddress ? [] : tokensPure),
    [mode, searchValueIsAddress, tokensPure],
  );

  const selectedTokens = useMemo(
    () =>
      tokens.filter(
        (token): token is AccountNFT =>
          token.tokenType === TokenType.NFT &&
          selectedTokenSlugs.includes(token.tokenSlug),
      ),
    [tokens, selectedTokenSlugs],
  );

  useEffect(() => {
    if (!multiSelectEnabled || !isNftsSelected) {
      setRedeemDisabledSlugs(new Set());
      return;
    }

    let cancelled = false;

    (async () => {
      const nftTokens = tokens.filter(
        (token): token is AccountNFT => token.tokenType === TokenType.NFT,
      );
      const keys = nftTokens.map((token) => {
        const { address } = parseTokenSlug(token.tokenSlug);
        return `redeem_${token.chainId}_${address.toLowerCase()}_${token.tokenId}`;
      });
      const cached = await storage.fetchMany<{ status?: string }>(keys);
      if (cancelled) return;
      const next = new Set<string>();
      cached.forEach((val, idx) => {
        if (val?.status) {
          next.add(nftTokens[idx].tokenSlug);
        }
      });
      setRedeemDisabledSlugs(next);
    })().catch(() => {
      if (!cancelled) setRedeemDisabledSlugs(new Set());
    });

    return () => {
      cancelled = true;
    };
  }, [multiSelectEnabled, isNftsSelected, tokens]);

  const redeemTokens = useMemo(
    () =>
      selectedTokens.map((token) => {
        const { address } = parseTokenSlug(token.tokenSlug);
        return {
          contract: address,
          tokenId: token.tokenId,
          title: token.name ?? token.tokenId,
        };
      }),
    [selectedTokens],
  );

  useEffect(() => {
    if (!isNftsSelected || manageModeEnabled || mode !== null) {
      setMultiSelectEnabled(false);
      setSelectedTokenSlugs([]);
    }
  }, [isNftsSelected, manageModeEnabled, mode]);

  // A little hack to avoid using `manageModeEnabled` dependency
  const manageModeEnabledRef = useRef<boolean>();
  if (manageModeEnabledRef.current !== manageModeEnabled) {
    manageModeEnabledRef.current = manageModeEnabled;
  }

  useEffect(() => {
    if (!tokenSlug) {
      setDefaultTokenRef.current = true;
    }
  }, [tokenSlug]);

  useEffect(() => {
    if (selectedToken && selectedToken.tokenType !== tokenType) {
      setDefaultTokenRef.current = true;
    }
  }, [selectedToken, tokenType]);

  useEffect(() => {
    if (
      setDefaultTokenRef.current &&
      tokens.length > 0 &&
      !manageModeEnabledRef.current
    ) {
      setTokenSlug([tokens[0].tokenSlug, "replace"]);
      setDefaultTokenRef.current = false;
    }
  }, [setTokenSlug, tokens]);

  const handleTokenSelect = useCallback(
    async (token: AccountToken) => {
      if (manageModeEnabled) {
        await toggleTokenStatus(token);
      } else if (multiSelectEnabled && token.tokenType === TokenType.NFT) {
        if (redeemDisabledSlugs.has(token.tokenSlug)) return;
        setSelectedTokenSlugs((prev) =>
          prev.includes(token.tokenSlug)
            ? prev.filter((slug) => slug !== token.tokenSlug)
            : [...prev, token.tokenSlug],
        );
      } else {
        setTokenSlug([token.tokenSlug, "replace"]);
      }
    },
    [manageModeEnabled, multiSelectEnabled, redeemDisabledSlugs, setTokenSlug],
  );

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
        isSelected={selectedTokenSlugs.includes(nft.tokenSlug)}
        isRedeemDisabled={redeemDisabledSlugs.has(nft.tokenSlug)}
        isActive={!manageModeEnabled && tokenSlug === nft.tokenSlug}
        onSelect={handleTokenSelect}
        isManageMode={manageModeEnabled}
      />
    ),
    [
      tokens.length,
      selectedTokenSlugs,
      multiSelectEnabled,
      redeemDisabledSlugs,
      manageModeEnabled,
      tokenSlug,
      handleTokenSelect,
      loadMoreTriggerRef,
    ],
  );

  let tokensBar: ReactNode = null;

  if (tokens.length === 0) {
    if (searchValue) {
      tokensBar = (
        <NullState searching={searching} focusSearchInput={focusSearchInput} />
      );
    } else if (isNftsSelected) {
      tokensBar = <NoNftState syncing={syncing} />;
    }
  } else {
    tokensBar = (
      <ScrollAreaContainer
        ref={scrollAreaRef}
        hiddenScrollbar="horizontal"
        className="pr-5 -mr-5 mt-4"
        viewPortClassName="rounded-t-[.625rem] viewportBlock"
        scrollBarClassName="py-0"
      >
        {!isNftsSelected ? (
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
                isActive={!manageModeEnabled && tokenSlug === asset.tokenSlug}
                onAssetSelect={handleTokenSelect}
                isManageMode={manageModeEnabled}
                className={classNames(i !== tokens.length - 1 && "mb-2")}
              />
            ))}
          </>
        ) : (
          <Masonry items={tokens} renderItem={renderNFTCard} gap="0.25rem" />
        )}
      </ScrollAreaContainer>
    );
  }

  return (
    <>
      <AssetsManagement
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
      />
      {isNftsSelected && mode === null && !manageModeEnabled && (
        <div className="flex items-center justify-between mt-3">
          <Button
            theme="secondary"
            className="!py-2"
            onClick={() => {
              setMultiSelectEnabled((prev) => !prev);
              setSelectedTokenSlugs([]);
            }}
          >
            {multiSelectEnabled
              ? t("redeem.batch.cancel")
              : t("redeem.batch.select")}
          </Button>
          {multiSelectEnabled && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-gray">
                {t("redeem.batch.selected")}: {selectedTokens.length}
              </span>
              <Button
                className="!py-2"
                disabled={selectedTokens.length === 0}
                onClick={() => {
                  setBatchRedeemOpened(true);
                }}
              >
                {t("redeem.batch.redeem")}
              </Button>
            </div>
          )}
        </div>
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
});
