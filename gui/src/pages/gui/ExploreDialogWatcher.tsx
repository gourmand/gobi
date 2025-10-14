import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch } from "../../redux/hooks";
import { setIsExploreDialogOpen } from "../../redux/slices/uiSlice";
import {
    getLocalStorage,
    LocalStorageKey,
    setLocalStorage,
} from "../../util/localStorage";

const useTutorialListener = (onTutorialClosed: () => void) => {
  useWebviewListener("didCloseFiles", async (data) => {
    const uris = data?.uris ?? [];

    const isTutorial = uris.some((uri) => {
      const lowercaseUri = uri.toLowerCase();
      return (
        lowercaseUri.endsWith("gobi_tutorial.py") ||
        lowercaseUri.endsWith("gobi_tutorial.java") ||
        lowercaseUri.endsWith("gobi_tutorial.ts")
      );
    });

    if (isTutorial) {
      onTutorialClosed();
    }
  });
};

export const ExploreDialogWatcher = () => {
  const dispatch = useAppDispatch();

  useTutorialListener(() => {
    setLocalStorage(LocalStorageKey.IsExploreDialogOpen, true);

    if (!getLocalStorage(LocalStorageKey.HasDismissedExploreDialog)) {
      dispatch(setIsExploreDialogOpen(true));
    }
  });
  return null;
};
