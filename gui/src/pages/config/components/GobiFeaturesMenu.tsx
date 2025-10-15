import ToggleSwitch from "../../../components/gui/Switch";
interface GobiFeaturesMenuProps {
  enableStaticContextualization: boolean;
  handleEnableStaticContextualizationToggle: (value: boolean) => void;
}

export function GobiFeaturesMenu({
  enableStaticContextualization,
  handleEnableStaticContextualizationToggle,
}: GobiFeaturesMenuProps) {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="my-2 text-center text-xs font-medium text-slate-400">
        🚧 INTERNAL SETTINGS 🚧
      </div>
      <div className="flex w-full flex-col gap-y-4">
        <ToggleSwitch
          isToggled={enableStaticContextualization}
          onToggle={() =>
            handleEnableStaticContextualizationToggle(
              !enableStaticContextualization,
            )
          }
          text="Use Static Contextualization"
        />
      </div>
    </div>
  );
}
