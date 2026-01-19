import { FC, PropsWithChildren } from "react";
import classNames from "clsx";

import { Page } from "app/nav";
import { pageAtom } from "app/atoms";
import ContentContainer from "app/components/layouts/ContentContainer";
import Button from "app/components/elements/Button";
import BackButton from "app/components/elements/BackButton";
import NodeVaultLogoImage from "app/images/nodevault.png";
import { ReactComponent as ArrowLeftLongIcon } from "app/icons/arrow-left-long.svg";
// import WelcomeBgImage from "app/images/welcome-bg.jpg";
// import WelcomeTreeLeftImage from "app/images/welcome-tree-left.png";
// import WelcomeTreeRightImage from "app/images/welcome-tree-right.png";
// import WelcomeFireImage from "app/images/welcome-fire.png";

type BoardingPageLayoutProps = {
  header?: boolean;
  isWelcome?: boolean;
};

let bootAnimationDisplayed = true;
const handleBootAnimationEnd = () => {
  bootAnimationDisplayed = false;
};

const BoardingPageLayout: FC<PropsWithChildren<BoardingPageLayoutProps>> = ({
  header = true,
  isWelcome = false,
  children,
}) => (
  <div
    className={classNames(
      bootAnimationDisplayed &&
        (isWelcome ? "animate-bootfadeinslow" : "animate-bootfadein"),
      "relative",
      "min-h-screen flex flex-col",
      "bg-center bg-cover",
    )}
    style={{
      backgroundImage: /*isWelcome ? `url('${WelcomeBgImage}')` : */ "none",
    }}
    onAnimationEnd={bootAnimationDisplayed ? handleBootAnimationEnd : undefined}
  >
    <ContentContainer narrow className="relative pt-[14vh]">
      {header && (
        <header className="flex items-stretch relative">
          {isWelcome ? (
            <Button
              theme="clean"
              to={{ page: "profiles" }}
              className="absolute bottom-2 left-0 group !font-bold"
            >
              <ArrowLeftLongIcon
                className={classNames(
                  "mr-2",
                  "transition-transform",
                  "group-hover:-translate-x-1.5 group-focus:-translate-x-1.5",
                )}
              />
              Profiles
            </Button>
          ) : (
            <BackButton
              navAtom={pageAtom}
              initialValue={Page.Default}
              className="absolute bottom-2 left-0 !font-bold"
            />
          )}
        </header>
      )}

      <div className="mb-24">{children}</div>
    </ContentContainer>
    {!isWelcome ? (
      <div
        className={classNames(
          "mt-auto mb-6",
          "text-2xl",
          "font-black",
          "w-full flex justify-center items-center",
        )}
      >
        <img
          src={NodeVaultLogoImage}
          alt="NodeVault"
          className={classNames("h-[2rem]", "w-[2rem] mr-3")}
        />
        <span>NodeVault</span>
      </div>
    ) : (
      <></>
    )}
  </div>
);

export default BoardingPageLayout;
