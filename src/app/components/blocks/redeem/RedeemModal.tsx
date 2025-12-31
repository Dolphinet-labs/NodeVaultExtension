import { FC, useCallback, useMemo, useState } from "react";
import classNames from "clsx";

import { SelfActivityKind } from "core/types";

import { t } from "lib/ext/i18n";
import { useI18NUpdate } from "lib/ext/i18n/react";

import { useAccounts, useChainId, useProvider } from "app/hooks";
import { useToast } from "app/hooks/toast";
import SecondaryModal from "app/components/elements/SecondaryModal";
import Button from "app/components/elements/Button";
import Input from "app/components/elements/Input";
import LongTextField from "app/components/elements/LongTextField";
import { redeemGetNonce, redeemSubmit } from "app/api/redeem";
import type { RedeemStatus } from "app/hooks/redeem";

type RedeemModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: {
    contract: string;
    tokenId: string;
    title?: string;
  };
  onSuccess?: (status: RedeemStatus) => void;
};

const DOLPHINET_CHAIN_IDS = new Set([1520, 1519]);

const RedeemModal: FC<RedeemModalProps> = ({
  open,
  onOpenChange,
  token,
  onSuccess,
}) => {
  useI18NUpdate();
  const chainId = useChainId();
  const provider = useProvider();
  const { currentAccount } = useAccounts();
  const { updateToast } = useToast();

  const redeemEnabled = DOLPHINET_CHAIN_IDS.has(chainId);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<
    null | { alreadyRedeemed?: boolean; status?: string }
  >(null);

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
      }
    },
    [onOpenChange],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      provider.setActivitySource({
        type: "self",
        kind: SelfActivityKind.Unknown,
      });

      const tokenKey = {
        chainId,
        contract: token.contract,
        tokenId: token.tokenId,
        walletAddress: currentAccount.address,
      };

      const { nonce, messageToSign } = await redeemGetNonce(tokenKey);

      const signer = provider.getUncheckedSigner(currentAccount.address);
      const signature = await signer.signMessage(messageToSign);

      const res = await redeemSubmit({
        token: tokenKey,
        nonce,
        message: messageToSign,
        signature,
        shipping: {
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          note: note.trim() ? note.trim() : null,
        },
      });

      if ("message" in res) {
        throw new Error(res.message || "Submit failed");
      }

      setSuccess({ alreadyRedeemed: res.alreadyRedeemed, status: res.status });

      const nextStatus = ((): RedeemStatus => {
        const s = res.status ?? "pending";
        return (
          s === "pending" ||
          s === "confirmed" ||
          s === "shipping" ||
          s === "delivered" ||
          s === "returning"
            ? s
            : "pending"
        );
      })();
      onSuccess?.(nextStatus);
      updateToast(t("redeem.toast.submitted"));
      handleClose(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redeem failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    provider,
    chainId,
    token.contract,
    token.tokenId,
    currentAccount.address,
    name,
    address,
    phone,
    email,
    note,
    onSuccess,
    updateToast,
    handleClose,
  ]);

  return (
    <SecondaryModal
      open={open}
      onOpenChange={handleClose}
      header={token.title ? `${t("redeem.action")}: ${token.title}` : t("redeem.action")}
      small
      className="max-w-[28rem] items-stretch"
      headerClassName="!text-lg !mb-4"
    >
      {!redeemEnabled ? (
        <div className="text-sm text-brand-gray">
          {t("redeem.unavailable")}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1">
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
                  ? `Already redeemed${success.status ? ` (status: ${success.status})` : ""}.`
                  : "Submitted successfully. We will contact you soon."}
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


