'use client';

/**
 * Hello widget — appears on the phone home screen.
 * All copy comes from the server (passed as props) so no client namespace is needed.
 */
type Props = {
  name: string;
  lede: string;
  available: boolean;
  availabilityLabel: string;
};

export function HelloWidget({ name, lede, available, availabilityLabel }: Props) {
  return (
    <div data-widget="hello" className="os-phone-widget">
      <div className="os-phone-widget-titlebar">
        <span className="os-phone-widget-title">hola.txt</span>
      </div>
      <div className="os-phone-widget-body os-phone-hello-body">
        <p className="os-phone-hello-name">{name}</p>
        <p className="os-phone-hello-lede">{lede}</p>
        <p
          className="os-phone-hello-avail"
          data-available={String(available)}
          aria-label={availabilityLabel}
        >
          <span className="os-phone-avail-dot" aria-hidden="true" />
          <span>{availabilityLabel}</span>
        </p>
      </div>
    </div>
  );
}
