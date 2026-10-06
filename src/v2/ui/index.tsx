import { useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as RadixTabs from "@radix-ui/react-tabs";
import { useI18n } from "../../i18n";
export { ToastProvider, useToast } from "../../ui";

export function Button({variant = "default",className = "",type = "button",...props}: ComponentProps<"button"> & {variant?:"default"|"primary"|"ghost"|"danger"}) {
  return <button {...props} type={type} className={`v2-button ${variant} ${className}`} />;
}

function Field({id,label,error,children}: {id:string;label:string;error?:string;children:ReactNode}) {
  return <div className="v2-field"><label htmlFor={id}>{label}</label>{children}{error ? <span id={id + "-error"} className="v2-field-error" role="alert">{error}</span> : null}</div>;
}
type FieldProps = {label:string;error?:string};
export function Input({label,error,id,...props}: ComponentProps<"input"> & FieldProps) {
  const generated = useId(); const key = id || generated;
  return <Field id={key} label={label} error={error}><input {...props} id={key} className={`v2-input ${props.className || ""}`} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={error ? key + "-error" : props["aria-describedby"]} /></Field>;
}
export function Textarea({label,error,id,...props}: ComponentProps<"textarea"> & FieldProps) {
  const generated = useId(); const key = id || generated;
  return <Field id={key} label={label} error={error}><textarea {...props} id={key} className={`v2-textarea ${props.className || ""}`} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={error ? key + "-error" : props["aria-describedby"]} /></Field>;
}
export function Select({label,error,id,...props}: ComponentProps<"select"> & FieldProps) {
  const generated = useId(); const key = id || generated;
  return <Field id={key} label={label} error={error}><select {...props} id={key} className={`v2-select ${props.className || ""}`} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={error ? key + "-error" : props["aria-describedby"]} /></Field>;
}
export function Checkbox({label,...props}: Omit<ComponentProps<"input">,"type"> & {label:string}) {
  return <label className="v2-checkbox"><input {...props} type="checkbox" /><span>{label}</span></label>;
}
export function Dialog({open,onOpenChange,title,description,children,trigger}: {open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;children:ReactNode;trigger?:ReactElement}) {
  const {t} = useI18n();
  const descriptionId = useId();
  return <RadixDialog.Root open={open} onOpenChange={onOpenChange}>{trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}<RadixDialog.Portal>
    <RadixDialog.Overlay className="v2-modal-backdrop" /><RadixDialog.Content className="v2-dialog" aria-describedby={description ? descriptionId : undefined}>
      <RadixDialog.Title>{title}</RadixDialog.Title>{description ? <RadixDialog.Description id={descriptionId} className="v2-dialog-description">{description}</RadixDialog.Description> : null}
      {children}<RadixDialog.Close asChild><Button className="v2-dialog-close">{t("common.close")}</Button></RadixDialog.Close>
    </RadixDialog.Content></RadixDialog.Portal></RadixDialog.Root>;
}
export function Menu({trigger,items}: {trigger:ReactElement;items:{label:string;onSelect:()=>void;disabled?:boolean;danger?:boolean}[]}) {
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger><DropdownMenu.Portal>
    <DropdownMenu.Content className="v2-menu" sideOffset={4}>{items.map((item,index) => <DropdownMenu.Item key={index} className={`v2-menu-item ${item.danger ? "danger" : ""}`} disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenu.Item>)}</DropdownMenu.Content>
  </DropdownMenu.Portal></DropdownMenu.Root>;
}
export function Tabs({value,onValueChange,items}: {value:string;onValueChange:(value:string)=>void;items:{value:string;label:string;content:ReactNode}[]}) {
  return <RadixTabs.Root value={value} onValueChange={onValueChange}><RadixTabs.List className="v2-tab-list">{items.map(item => <RadixTabs.Trigger key={item.value} value={item.value} className="v2-tab">{item.label}</RadixTabs.Trigger>)}</RadixTabs.List>
    {items.map(item => <RadixTabs.Content key={item.value} value={item.value} className="v2-tab-panel">{item.content}</RadixTabs.Content>)}
  </RadixTabs.Root>;
}
export function Tag({children,tone="neutral"}: {children:ReactNode;tone?:"neutral"|"success"|"danger"}) {
  return <span className={`v2-tag ${tone}`}>{children}</span>;
}
export function EmptyState({title,description,children}: {title:string;description?:string;children?:ReactNode}) {
  return <div className="v2-empty"><strong>{title}</strong>{description ? <p>{description}</p> : null}{children}</div>;
}
export function ErrorState({message,onRetry}: {message:string;onRetry?:()=>void}) {
  const {t} = useI18n(); return <div className="v2-error" role="alert"><p>{message}</p>{onRetry ? <Button onClick={onRetry}>{t("common.retry")}</Button> : null}</div>;
}
export function Skeleton({className=""}: {className?:string}) {
  const {t} = useI18n(); return <div className={`v2-skeleton ${className}`} role="status" aria-label={t("common.loading")} />;
}
