import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Beer, GlassWater, Wine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import {
  deleteMyDrink,
  type MyDrink,
  updateMyDrink,
  useCreateMyDrink,
  useMyDrink,
  useMyDrinks,
  useUpdateMyDrink,
} from "@/client/hooks/use-my-drinks.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { formatGrams, liveAlcoholGrams } from "@/client/lib/log-form.ts";
import {
  applyMyDrinkType,
  INITIAL_MY_DRINK_FORM,
  type MyDrinkFormErrors,
  type MyDrinkFormState,
  toMyDrinkBody,
  validateMyDrinkForm,
} from "@/client/lib/my-drink-form.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { calculateAlcoholGrams, displayAlcoholGrams } from "@/shared/alcohol.ts";
import { DRINK_TYPE_LABELS, type DrinkType, isWineFamily } from "@/shared/constants.ts";

const MY_DRINK_MAX = 30;

function DrinkIcon({ type }: { type: DrinkType }) {
  if (isWineFamily(type)) {
    return <Wine size={24} aria-hidden />;
  }
  if (type === "beer") {
    return <Beer size={24} aria-hidden />;
  }
  return <GlassWater size={24} aria-hidden />;
}

export function MyDrinkListPage() {
  const query = useMyDrinks();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [reordering, setReordering] = useState(false);

  async function move(items: readonly MyDrink[], index: number, direction: -1 | 1) {
    const adjacent = items[index + direction];
    const current = items[index];
    if (!current || !adjacent || reordering) {
      return;
    }
    setReordering(true);
    try {
      await Promise.all([
        updateMyDrink(current.id, { sortOrder: adjacent.sortOrder }),
        updateMyDrink(adjacent.id, { sortOrder: current.sortOrder }),
      ]);
    } catch {
      showToast({ message: TOAST_MESSAGES.saveFailed });
    } finally {
      await queryClient.invalidateQueries({ queryKey: queryKeys.myDrinks });
      setReordering(false);
    }
  }

  if (query.isPending) {
    return <ListSkeleton count={4} />;
  }
  if (query.isError) {
    return <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }
  if (query.data.items.length === 0) {
    return (
      <EmptyState
        pose="default"
        message="よく飲む一杯を登録すると 1 タップで記録できます"
        actionLabel="追加"
        actionTo="/logs/my-drinks/new"
      />
    );
  }

  return (
    <div className="mydrink-list-page">
      <div className="mydrink-list">
        {query.data.items.map((item, index) => (
          <div className="mydrink-row" key={item.id}>
            <Link className="mydrink-row-main" to={`/logs/my-drinks/${item.id}/edit`}>
              <span className="mydrink-icon">
                <DrinkIcon type={item.drinkType} />
              </span>
              <span className="mydrink-row-copy">
                <span className="mydrink-row-top">
                  <strong>{item.name}</strong>
                  <span>
                    {item.volumeMl}ml {item.abvPercent}%
                  </span>
                </span>
                <span className="mydrink-row-sub">
                  {DRINK_TYPE_LABELS[item.drinkType]} ・{" "}
                  {displayAlcoholGrams(
                    calculateAlcoholGrams(item.volumeMl, item.abvPercent),
                  ).toFixed(1)}{" "}
                  g
                </span>
              </span>
            </Link>
            <span className="mydrink-order-buttons">
              <IconButton
                label={`${item.name}を上へ`}
                disabled={index === 0 || reordering}
                onClick={() => void move(query.data.items, index, -1)}
              >
                <ArrowUp size={18} />
              </IconButton>
              <IconButton
                label={`${item.name}を下へ`}
                disabled={index === query.data.items.length - 1 || reordering}
                onClick={() => void move(query.data.items, index, 1)}
              >
                <ArrowDown size={18} />
              </IconButton>
            </span>
          </div>
        ))}
      </div>
      <p className="mydrink-list-note">上位 4 つがホームに出ます</p>
      {query.data.items.length >= MY_DRINK_MAX ? (
        <p className="mydrink-limit" role="status">
          上限は 30 件です
        </p>
      ) : null}
    </div>
  );
}

export function MyDrinkFormPage() {
  const navigate = useNavigate();
  const { myDrinkId } = useParams();
  const editing = Boolean(myDrinkId);
  const detail = useMyDrink(myDrinkId);
  const create = useCreateMyDrink();
  const update = useUpdateMyDrink();
  const { showToast } = useToast();
  const [state, setState] = useState<MyDrinkFormState>(INITIAL_MY_DRINK_FORM);
  const [errors, setErrors] = useState<MyDrinkFormErrors>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (detail.data && !initialized.current) {
      initialized.current = true;
      setState({
        name: detail.data.name,
        drinkType: detail.data.drinkType,
        volumeMl: detail.data.volumeMl,
        abvPercent: detail.data.abvPercent,
      });
    }
  }, [detail.data]);

  if (editing && detail.isPending) {
    return <ListSkeleton count={4} />;
  }
  if (editing && detail.isError) {
    if (isApiClientError(detail.error) && detail.error.code === "not_found") {
      return <NotFoundPage />;
    }
    return <QueryError onRetry={() => detail.refetch()} retrying={detail.isFetching} />;
  }

  const mutationPending = create.isPending || update.isPending;
  const grams = liveAlcoholGrams(state);
  const canSave = Object.keys(validateMyDrinkForm(state)).length === 0;

  function updateState(patch: Partial<MyDrinkFormState>) {
    setState((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function submit() {
    const clientErrors = validateMyDrinkForm(state);
    const body = toMyDrinkBody(state);
    if (!body || Object.keys(clientErrors).length > 0 || mutationPending) {
      setErrors(clientErrors);
      return;
    }
    const callbacks = {
      onSuccess: () => {
        showToast({ message: TOAST_MESSAGES.saved });
        navigate("/logs/my-drinks", { replace: true });
      },
      onError: (error: unknown) => {
        if (isApiClientError(error) && error.fields) {
          setErrors({
            name: error.fields.name?.[0],
            volumeMl: error.fields.volumeMl?.[0],
            abvPercent: error.fields.abvPercent?.[0],
            form: error.fields[""]?.[0] ?? error.fields.count?.[0],
          });
          return;
        }
        setErrors({ form: TOAST_MESSAGES.saveFailed });
      },
    };
    if (editing && myDrinkId) {
      update.mutate({ id: myDrinkId, body }, callbacks);
    } else {
      create.mutate(body, callbacks);
    }
  }

  async function remove() {
    if (!myDrinkId || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMyDrink(myDrinkId);
      showToast({ message: TOAST_MESSAGES.deleted });
      navigate("/logs/my-drinks", { replace: true });
    } catch {
      setDeleteOpen(false);
      setErrors({ form: TOAST_MESSAGES.saveFailed });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="form-page mydrink-form">
      {errors.form ? (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      ) : null}
      <div className="log-form-section">
        <label className="field-label" htmlFor="mydrink-name">
          名前
        </label>
        <Input
          id="mydrink-name"
          value={state.name}
          maxLength={40}
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => updateState({ name: event.target.value })}
        />
        {errors.name ? (
          <span className="field-error" role="alert">
            {errors.name}
          </span>
        ) : null}
      </div>
      <DrinkTypeChips
        value={state.drinkType}
        onChange={(drinkType) => {
          setState((current) => applyMyDrinkType(current, drinkType));
          setErrors({});
        }}
      />
      <VolumeField
        key={`mydrink-volume-${state.drinkType}`}
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={errors.volumeMl}
        onChange={(volumeMl) => updateState({ volumeMl })}
      />
      <AbvField
        key={`mydrink-abv-${state.drinkType}`}
        value={state.abvPercent}
        error={errors.abvPercent}
        onChange={(abvPercent) => updateState({ abvPercent })}
      />
      <p className="live-grams" aria-live="polite">
        ＝ {formatGrams(grams)} g
      </p>
      {editing ? (
        <button type="button" className="mydrink-delete" onClick={() => setDeleteOpen(true)}>
          このマイドリンクを削除
        </button>
      ) : null}
      <SaveBar pending={mutationPending} disabled={mutationPending || !canSave} onSave={submit} />
      <Dialog
        open={deleteOpen}
        title="マイドリンクを削除しますか"
        body="過去の記録は残ります"
        primaryLabel="削除する"
        destructive
        pending={deleting}
        onPrimary={() => void remove()}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
