import { FC, useMemo } from "react";
import classNames from "clsx";

import { t } from "lib/ext/i18n";
import { useI18NUpdate } from "lib/ext/i18n/react";

import SecondaryModal from "app/components/elements/SecondaryModal";
import Button from "app/components/elements/Button";
import { RedeemStatus } from "app/hooks/redeem";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: RedeemStatus;
};

const RedeemStatusModal: FC<Props> = ({ open, onOpenChange, status }) => {
  useI18NUpdate();

  const title = useMemo(() => {
    return t(`redeem_status_${status}_title`);
  }, [status]);

  const desc = useMemo(() => {
    return t(`redeem_status_${status}_desc`);
  }, [status]);

  return (
    <SecondaryModal
      open={open}
      onOpenChange={onOpenChange}
      header={title}
      small
      className="max-w-[28rem] items-stretch"
      headerClassName="!text-lg !mb-4"
    >
      <div
        className={classNames(
          "text-sm text-brand-light",
          "border border-brand-main/10 bg-black/10 rounded-[.625rem] p-4",
        )}
      >
        {desc}
      </div>

      <div className="mt-4">
        <Button className="w-full" onClick={() => onOpenChange(false)}>
          {t("common_ok")}
        </Button>
      </div>
    </SecondaryModal>
  );
};

export default RedeemStatusModal;


