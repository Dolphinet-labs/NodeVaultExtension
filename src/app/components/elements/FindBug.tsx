import classNames from "clsx";
import type { FC, ReactNode } from "react";
import { NODEVAULT_SUPPORT_EMAIL } from "app/constants/links";

const Title: FC<{ className?: string }> = ({ className }) => {
  return (
    <h1 className={classNames("text-[1.75rem] font-bold", className)}>
      Find bugs in our wallet, report and earn part of $1000+! 🎉
    </h1>
  );
};

const Content: FC<{ children?: ReactNode }> = ({ children }) => {
  if (children) {
    return children;
  }

  return (
    <div className="mb-6 flex flex-col w-full ml-6 text-left font-medium text-base text-brand-lightgray opacity-75">
      <p className="mb-3 text-lg">How do I participate in it?</p>
      <ol className="list-decimal ml-4">
        <li>Find a bug.</li>
        <li>
          Send a report to{" "}
          <a className="underline" href={`mailto:${NODEVAULT_SUPPORT_EMAIL}`}>
            {NODEVAULT_SUPPORT_EMAIL}
          </a>
          .
        </li>
      </ol>
    </div>
  );
};

export { Title, Content };
