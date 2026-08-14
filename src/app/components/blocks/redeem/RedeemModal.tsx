import { FC, useCallback, useMemo, useState, useEffect } from "react";
import classNames from "clsx";

import { SelfActivityKind } from "core/types";

import { t } from "lib/ext/i18n";
import { useI18NUpdate } from "lib/ext/i18n/react";

import { useAccounts, useChainId, useProvider } from "app/hooks";
import { useRedeemShippingHistory } from "app/hooks/redeemShipping";
import { useToast } from "app/hooks/toast";
import SecondaryModal from "app/components/elements/SecondaryModal";
import Button from "app/components/elements/Button";
import Input from "app/components/elements/Input";
import LongTextField from "app/components/elements/LongTextField";
import Select from "app/components/elements/Select";
import { redeemGetNonce, redeemSubmit } from "app/api/redeem";
import { normalizeRedeemStatus, type RedeemStatus } from "app/hooks/redeem";
import { isDolphinetChainId } from "fixtures/networks/dolphinet";

type RedeemToken = {
  contract: string;
  tokenId: string;
  title?: string;
};

type RedeemModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: RedeemToken[];
  onSuccess?: (
    status: RedeemStatus,
    token: { contract: string; tokenId: string },
  ) => void;
};

const shortTokenTitle = (token: RedeemToken) =>
  token.title ??
  `${token.contract.slice(0, 6)}...${token.contract.slice(-4)} #${
    token.tokenId
  }`;

const RedeemModal: FC<RedeemModalProps> = ({
  open,
  onOpenChange,
  tokens,
  onSuccess,
}) => {
  useI18NUpdate();
  const chainId = useChainId();
  const provider = useProvider();
  const { currentAccount } = useAccounts();
  const { updateToast } = useToast();
  const {
    items: shippingHistory,
    saveEntry,
    clearHistory,
  } = useRedeemShippingHistory(currentAccount.address);

  const redeemEnabled = isDolphinetChainId(chainId);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [selectedShippingKey, setSelectedShippingKey] = useState("new");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | {
    alreadyRedeemed?: boolean;
    status?: string;
  }>(null);
  const [batchResult, setBatchResult] = useState<{
    total: number;
    success: number;
    failed: number;
    failedTitles: string[];
  } | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const canSubmit = useMemo(() => {
    if (!redeemEnabled) return false;
    if (submitting) return false;
    if (!name.trim()) return false;
    if (!address.trim()) return false;
    if (!phone.trim()) return false;
    if (!email.trim()) return false;
    return true;
  }, [redeemEnabled, submitting, name, address, phone, email]);

  const handleClose = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) {
        setError(null);
        setSuccess(null);
        setBatchResult(null);
        setBatchProgress(null);
      }
    },
    [onOpenChange],
  );

  const applyShipping = useCallback(
    (entry: {
      name: string;
      address: string;
      phone: string;
      email: string;
      note?: string | null;
    }) => {
      setName(entry.name);
      setAddress(entry.address);
      setPhone(entry.phone);
      setEmail(entry.email);
      setNote(entry.note ?? "");
    },
    [],
  );

  const clearShippingForm = useCallback(() => {
    setName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setNote("");
  }, []);

  const shippingHistoryMap = useMemo(() => {
    return new Map(shippingHistory.map((entry) => [entry.id, entry]));
  }, [shippingHistory]);

  const shippingItems = useMemo(() => {
    const items: { key: string; value: string }[] = [
      {
        key: "new",
        value: t("redeem.form.history.new"),
      },
    ];

    shippingHistory.forEach((entry) => {
      items.push({
        key: entry.id,
        value: `${entry.name} · ${entry.address}`,
      });
    });

    return items;
  }, [shippingHistory]);

  const currentShippingItem = useMemo(() => {
    return (
      shippingItems.find((item) => item.key === selectedShippingKey) ??
      shippingItems[0]
    );
  }, [shippingItems, selectedShippingKey]);

  useEffect(() => {
    if (!open) return;

    if (
      selectedShippingKey === "new" &&
      shippingHistory.length > 0 &&
      !name &&
      !address &&
      !phone &&
      !email &&
      !note
    ) {
      const latest = shippingHistory[0];
      setSelectedShippingKey(latest.id);
      applyShipping(latest);
    }
  }, [
    open,
    selectedShippingKey,
    shippingHistory,
    name,
    address,
    phone,
    email,
    note,
    applyShipping,
  ]);

  useEffect(() => {
    if (
      selectedShippingKey !== "new" &&
      !shippingHistoryMap.has(selectedShippingKey)
    ) {
      setSelectedShippingKey("new");
    }
  }, [selectedShippingKey, shippingHistoryMap]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setBatchResult(null);
    setBatchProgress(null);

    try {
      provider.setActivitySource({
        type: "self",
        kind: SelfActivityKind.Unknown,
      });

      const signer = provider.getUncheckedSigner(currentAccount.address);

      const shipping = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        note: note.trim() ? note.trim() : null,
      };

      const redeemOne = async (token: RedeemToken) => {
        const tokenKey = {
          chainId,
          contract: token.contract,
          tokenId: token.tokenId,
          walletAddress: currentAccount.address,
        };

        const { nonce, messageToSign } = await redeemGetNonce(tokenKey);
        const signature = await signer.signMessage(messageToSign);

        const res = await redeemSubmit({
          token: tokenKey,
          nonce,
          message: messageToSign,
          signature,
          shipping,
        });

        if ("message" in res) {
          throw new Error(res.message || "Submit failed");
        }

        onSuccess?.(normalizeRedeemStatus(res.status), tokenKey);

        return res;
      };

      if (tokens.length === 1) {
        const res = await redeemOne(tokens[0]);

        setSuccess({
          alreadyRedeemed: res.alreadyRedeemed,
          status: res.status,
        });
      } else {
        const total = tokens.length;
        let successCount = 0;
        const failedTitles: string[] = [];

        for (let i = 0; i < tokens.length; i += 1) {
          setBatchProgress({ current: i + 1, total });

          try {
            await redeemOne(tokens[i]);
            successCount += 1;
          } catch {
            failedTitles.push(shortTokenTitle(tokens[i]));
          }
        }

        setBatchResult({
          total,
          success: successCount,
          failed: failedTitles.length,
          failedTitles,
        });

        if (failedTitles.length > 0) {
          setError(
            `${t("redeem.batch.failed")}: ${failedTitles.length}/${total}`,
          );
        }
      }
      await saveEntry({
        name,
        address,
        phone,
        email,
        note: note.trim() ? note.trim() : null,
      });
      updateToast(t("redeem.toast.submitted"));
      handleClose(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redeem failed";
      setError(msg);
    } finally {
      setSubmitting(false);
      setBatchProgress(null);
    }
  }, [
    canSubmit,
    provider,
    chainId,
    tokens,
    currentAccount.address,
    name,
    address,
    phone,
    email,
    note,
    onSuccess,
    saveEntry,
    updateToast,
    handleClose,
  ]);

  const header = (() => {
    if (tokens.length === 1 && tokens[0]?.title) {
      return `${t("redeem.action")}: ${tokens[0].title}`;
    }
    if (tokens.length > 1) {
      return `${t("redeem.action")} (${tokens.length})`;
    }
    return t("redeem.action");
  })();

  return (
    <SecondaryModal
      open={open}
      onOpenChange={handleClose}
      header={header}
      small
      className="max-w-[28rem] items-stretch"
      headerClassName="!text-lg !mb-4"
    >
      {!redeemEnabled ? (
        <div className="text-sm text-brand-gray">{t("redeem.unavailable")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1">
            {tokens.length > 1 && (
              <div className="text-xs text-brand-gray border border-brand-main/10 bg-black/10 rounded-[.625rem] p-3">
                <div className="text-sm font-bold text-brand-light">
                  {t("redeem.batch.title")}
                </div>
                <div className="mt-1">
                  {t("redeem.batch.count")}: {tokens.length}
                </div>
                <div className="mt-2 max-h-24 overflow-y-auto pr-1">
                  {tokens.map((token) => (
                    <div
                      key={`${token.contract}_${token.tokenId}`}
                      className="truncate"
                    >
                      {shortTokenTitle(token)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Select
              label={t("redeem.form.history.label")}
              items={shippingItems}
              currentItem={currentShippingItem}
              setItem={(item) => {
                const nextKey = String(item.key);
                setSelectedShippingKey(nextKey);
                if (nextKey === "new") {
                  clearShippingForm();
                  return;
                }

                const entry = shippingHistoryMap.get(nextKey);
                if (entry) {
                  applyShipping(entry);
                }
              }}
              size="small"
              className="min-w-0"
              currentItemClassName="!py-2 !pl-3 !pr-2 text-xs"
              contentClassName="!mt-1"
              scrollAreaClassName="!max-h-44"
            />
            {batchProgress && (
              <div className="text-xs text-brand-gray">
                {t("redeem.batch.progress")}: {batchProgress.current}/
                {batchProgress.total}
              </div>
            )}
            {shippingHistory.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-gray">
                  {t("redeem.form.history.hint")}
                </span>
                <button
                  type="button"
                  className="text-xs text-brand-main underline"
                  onClick={() => {
                    clearHistory()
                      .then(() => {
                        setSelectedShippingKey("new");
                        clearShippingForm();
                      })
                      .catch(console.error);
                  }}
                  disabled={submitting}
                >
                  {t("redeem.form.history.clear")}
                </button>
              </div>
            )}
            <Input
              label={t("redeem.form.name.label")}
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder={t("redeem.form.name.placeholder")}
              disabled={submitting}
              error={Boolean(error) && !name.trim()}
            />
            <LongTextField
              label={t("redeem.form.address.label")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("redeem.form.address.placeholder")}
              disabled={submitting}
              className="w-full"
              textareaClassName="!h-20"
              error={Boolean(error) && !address.trim()}
            />
            <Input
              label={t("redeem.form.phone.label")}
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder={t("redeem.form.phone.placeholder")}
              disabled={submitting}
              error={Boolean(error) && !phone.trim()}
            />
            <Input
              label={t("redeem.form.email.label")}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder={t("redeem.form.email.placeholder")}
              disabled={submitting}
              error={Boolean(error) && !email.trim()}
            />
            <LongTextField
              label={t("redeem.form.note.label")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("redeem.form.note.placeholder")}
              disabled={submitting}
              className="w-full"
              textareaClassName="!h-16"
            />

            <div
              className={classNames(
                "text-xs text-brand-gray",
                "border border-brand-main/10 bg-black/10 rounded-[.625rem] p-3",
              )}
            >
              {t("redeem.form.privacy")}
            </div>

            {error && (
              <div className="text-xs text-brand-redtext border border-brand-redobject/30 bg-black/10 rounded-[.625rem] p-3">
                {error}
              </div>
            )}

            {success && (
              <div className="text-xs text-brand-light border border-brand-greenobject/30 bg-black/10 rounded-[.625rem] p-3">
                {success.alreadyRedeemed
                  ? `Already redeemed${
                      success.status ? ` (status: ${success.status})` : ""
                    }.`
                  : "Submitted successfully. We will contact you soon."}
              </div>
            )}
            {batchResult && (
              <div className="text-xs text-brand-light border border-brand-greenobject/30 bg-black/10 rounded-[.625rem] p-3">
                {batchResult.failed === 0
                  ? `${t("redeem.batch.success")}: ${batchResult.success}/${batchResult.total}`
                  : `${t("redeem.batch.partial")}: ${batchResult.success}/${batchResult.total}`}
                {batchResult.failedTitles.length > 0 && (
                  <div className="mt-1 text-brand-gray">
                    {t("redeem.batch.failed.items")}:{" "}
                    {batchResult.failedTitles.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
          >
            {submitting ? t("redeem.form.submitting") : t("redeem.form.submit")}
          </Button>
        </div>
      )}
    </SecondaryModal>
  );
};

export default RedeemModal;
