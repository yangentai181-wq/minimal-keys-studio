import { CURRENT_APP_VERSION } from "./update/versionCheck";
import identity from "./brand/identity.json";

export interface AppFooterProps {
  onShowAbout: () => void;
  onShowLicenseNotice: () => void;
}

export const AppFooter = ({
  onShowAbout,
  onShowLicenseNotice,
}: AppFooterProps) => {
  return (
    <div className="grid justify-center p-1 bg-base-200">
      <div>
        <span>{identity.productName} v{CURRENT_APP_VERSION}</span> —{" "}
        <button
          type="button"
          className="hover:text-primary hover:underline"
          onClick={onShowAbout}
        >
          ZMK Contributorsへの謝辞
        </button>{" "}
        —{" "}
        <button
          type="button"
          className="hover:text-primary hover:underline"
          onClick={onShowLicenseNotice}
        >
          License NOTICE
        </button>
      </div>
    </div>
  );
};
