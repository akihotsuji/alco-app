type FieldLabelProps = {
  htmlFor?: string;
  children: string;
  required?: boolean;
  optional?: boolean;
};

export function FieldLabel({
  htmlFor,
  children,
  required = false,
  optional = false,
}: FieldLabelProps) {
  const content = (
    <>
      {children}
      {required ? <span className="field-req">必須</span> : null}
      {optional ? <span className="field-opt">任意</span> : null}
    </>
  );
  if (htmlFor) {
    return (
      <label className="field-label" htmlFor={htmlFor}>
        {content}
      </label>
    );
  }
  return <span className="field-label">{content}</span>;
}
