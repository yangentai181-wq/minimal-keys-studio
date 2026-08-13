import { Pencil, Minus, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  DropIndicator,
  Label,
  ListBox,
  ListBoxItem,
  Selection,
  useDragAndDrop,
} from "react-aria-components";
import { useModalRef } from "../misc/useModalRef";
import { GenericModal } from "../GenericModal";
import { getMinimalKeysLayerRole, hasPrecisionLayer, isPrecisionLayerId } from "./minimal-keys-layers";

interface Layer {
  id: number;
  name?: string;
}

export type LayerClickCallback = (index: number) => void;
export type LayerMovedCallback = (layerId: number, destinationLayerId: number) => void;

interface LayerPickerProps {
  layers: Array<Layer>;
  selectedLayerIndex: number;
  canAdd?: boolean;
  canRemove?: boolean;
  /** Drag-to-reorder. Off means the list order cannot be changed at all. */
  canReorder?: boolean;
  selectionLocked?: boolean;
  showInactiveAutoMouseLayer?: boolean;
  layerOperationsLockedMessage?: string;

  onLayerClicked?: LayerClickCallback;
  onLayerMoved?: LayerMovedCallback;
  onAddClicked?: () => void | Promise<void>;
  onRemoveClicked?: () => void | Promise<void>;
  onLayerNameChanged?: (
    id: number,
    oldName: string,
    newName: string
  ) => void | Promise<void>;
}

interface EditLabelData {
  id: number;
  name: string;
}

const EditLabelModal = ({
  open,
  onClose,
  editLabelData,
  handleSaveNewLabel,
}: {
  open: boolean;
  onClose: () => void;
  editLabelData: EditLabelData;
  handleSaveNewLabel: (
    id: number,
    oldName: string,
    newName: string | null
  ) => void;
}) => {
  const ref = useModalRef(open);
  const [newLabelName, setNewLabelName] = useState(editLabelData.name);

  const handleSave = () => {
    handleSaveNewLabel(editLabelData.id, editLabelData.name, newLabelName);
    onClose();
  };

  return (
    <GenericModal
      ref={ref}
      onClose={onClose}
      className="min-w-min w-[30vw] flex flex-col"
    >
      <span className="mb-3 text-lg">New Layer Name</span>
      <input
        className="p-1 border rounded border-base-content border-solid"
        type="text"
        defaultValue={editLabelData.name}
        autoFocus
        onChange={(e) => setNewLabelName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
      />
      <div className="mt-4 flex justify-end">
        <button className="py-1.5 px-2" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="py-1.5 px-2 ml-4 rounded-md bg-gray-100 text-black hover:bg-gray-300"
          type="button"
          onClick={() => {
            handleSave();
          }}
        >
          Save
        </button>
      </div>
    </GenericModal>
  );
};

const layerRoleBadge = (layerId: number) => {
  const role = getMinimalKeysLayerRole(layerId);
  if (role === "autoMouse") {
    return {
      label: "Auto Mouse",
      className: "bg-orange-50 text-orange-600 border-orange-200",
    };
  }
  if (role === "scroll") {
    return {
      label: "Scroll",
      className: "bg-teal-50 text-teal-700 border-teal-200",
    };
  }
  return null;
};

export const LayerPicker = ({
  layers,
  selectedLayerIndex,
  canAdd,
  canRemove,
  canReorder = true,
  selectionLocked = false,
  showInactiveAutoMouseLayer = true,
  layerOperationsLockedMessage,
  onLayerClicked,
  onLayerMoved,
  onAddClicked,
  onRemoveClicked,
  onLayerNameChanged,
  ...props
}: LayerPickerProps) => {
  const [editLabelData, setEditLabelData] = useState<EditLabelData | null>(
    null
  );
  const layerOperationsLocked = hasPrecisionLayer(layers);

  const layer_items = useMemo(() => {
    return layers
      .map((l, i) => ({
        name: l.name || i.toLocaleString(),
        id: l.id,
        index: i,
        selected: i === selectedLayerIndex,
      }))
      .filter((item) => {
        if (isPrecisionLayerId(item.id)) return false;
        const role = getMinimalKeysLayerRole(item.id);
        return (
          showInactiveAutoMouseLayer ||
          role !== "autoMouse" ||
          item.selected
        );
      });
  }, [layers, selectedLayerIndex, showInactiveAutoMouseLayer]);

  const selectedLayerItem = useMemo(
    () => layer_items.find((l) => l.index === selectedLayerIndex),
    [layer_items, selectedLayerIndex]
  );

  const selectionChanged = useCallback(
    (s: Selection) => {
      if (selectionLocked || s === "all") {
        return;
      }

      const selectedItem = layer_items.find((l) => s.has(l.id));
      if (selectedItem) {
        onLayerClicked?.(selectedItem.index);
      }
    },
    [selectionLocked, onLayerClicked, layer_items]
  );

  const { dragAndDropHooks } = useDragAndDrop({
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className={"data-[drop-target]:outline outline-1 outline-accent"}
        />
      );
    },
    getItems: (keys) =>
      [...keys].map((key) => ({ "text/plain": key.toLocaleString() })),
    onReorder(e) {
      const startItem = layer_items.find((l) => e.keys.has(l.id));
      const endItem = layer_items.find((l) => l.id === e.target.key);
      if (startItem && endItem) {
        onLayerMoved?.(startItem.id, endItem.id);
      }
    },
  });

  const handleSaveNewLabel = useCallback(
    (id: number, oldName: string, newName: string | null) => {
      if (newName !== null) {
        onLayerNameChanged?.(id, oldName, newName);
      }
    },
    [onLayerNameChanged]
  );

  return (
    <div className="flex flex-col min-w-40">
      <div className="grid grid-cols-[1fr_auto_auto] items-center">
        <Label className="after:content-[':'] text-base font-medium">Layers</Label>
        {onRemoveClicked && (
          <button
            type="button"
            className="hover:text-primary-content hover:bg-primary rounded-sm"
            disabled={!canRemove || layerOperationsLocked}
            title={layerOperationsLockedMessage}
            onClick={onRemoveClicked}
          >
            <Minus className="size-4" />
          </button>
        )}
        {onAddClicked && (
          <button
            type="button"
            disabled={!canAdd || layerOperationsLocked}
            title={layerOperationsLockedMessage}
            className="hover:text-primary-content ml-1 hover:bg-primary rounded-sm disabled:text-gray-500 disabled:hover:bg-base-300 disabled:cursor-not-allowed"
            onClick={onAddClicked}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {editLabelData !== null && (
        <EditLabelModal
          open={editLabelData !== null}
          onClose={() => setEditLabelData(null)}
          editLabelData={editLabelData}
          handleSaveNewLabel={handleSaveNewLabel}
        />
      )}
      <ListBox
        aria-label="Keymap Layer"
        selectionMode="single"
        items={layer_items}
        disallowEmptySelection={true}
        selectedKeys={selectedLayerItem ? [selectedLayerItem.id] : []}
        className={`ml-2 items-center justify-center ${selectionLocked ? "cursor-default" : "cursor-pointer"}`}
        onSelectionChange={selectionChanged}
        dragAndDropHooks={canReorder ? dragAndDropHooks : undefined}
        {...props}
      >
        {(layer_item) => (
          <ListBoxItem
            textValue={layer_item.name}
            className={`p-1 b-1 my-1 group grid grid-cols-[1fr_auto] items-center aria-selected:bg-primary aria-selected:text-primary-content border rounded border-transparent border-solid ${selectionLocked ? "" : "hover:bg-base-300"}`}
          >
            <span className="min-w-0 flex items-center gap-1.5">
              <span className="text-sm truncate">{layer_item.name}</span>
              {layer_item.selected && (
                <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary">
                  Live
                </span>
              )}
              {(() => {
                const badge = layerRoleBadge(layer_item.id);
                if (!badge) return null;
                return (
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] leading-none ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                );
              })()}
            </span>
            <Pencil
              className="h-4 w-4 mx-1 invisible group-hover:visible"
              onClick={() =>
                setEditLabelData({ id: layer_item.id, name: layer_item.name })
              }
            />
          </ListBoxItem>
        )}
      </ListBox>
    </div>
  );
};
