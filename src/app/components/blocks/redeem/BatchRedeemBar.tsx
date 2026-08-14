import { FC } from "react";
import classNames from "clsx";

import { t } from "lib/ext/i18n";
import { useI18NUpdate } from "lib/ext/i18n/react";

import Button from "app/components/elements/Button";

type BatchRedeemBarProps = {
  multiSelectEnabled: boolean;
  selectedCount: number;
  onToggleMultiSelect: () => void;
  onRedeem: () => void;
  className?: string;
};

const BatchRedeemBar: FC<BatchRedeemBarProps> = ({
  multiSelectEnabled,
  selectedCount,
  onToggleMultiSelect,
  onRedeem,
  className,
}) => {
  useI18NUpdate();

  return (
    <div className={classNames("flex items-center justify-between", className)}>
      <Button theme="secondary" className="!py-2" onClick={onToggleMultiSelect}>
        {multiSelectEnabled
          ? t("redeem.batch.cancel")
          : t("redeem.batch.select")}
      </Button>
      {multiSelectEnabled && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-brand-gray">
            {t("redeem.batch.selected")}: {selectedCount}
          </span>
          <Button
            className="!py-2"
            disabled={selectedCount === 0}
            onClick={onRedeem}
          >
            {t("redeem.batch.redeem")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default BatchRedeemBar;
