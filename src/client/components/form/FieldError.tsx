type FieldErrorProps = {
  id: string;
  error?: string;
};

export function fieldDescribedBy(id: string, error?: string): string | undefined {
  return error ? `${id}-error` : undefined;
}

export function FieldError({ id, error }: FieldErrorProps) {
  if (!error) {
    return null;
  }
  return (
    <p id={`${id}-error`} className="field-error" role="alert">
      {error}
    </p>
  );
}
