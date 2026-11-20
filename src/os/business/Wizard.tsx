'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buildProjectMessage, type BusinessKind, type NeedKind } from './message';
import { whatsappHref, mailtoHref } from '@/content/contact';

type Channel = 'whatsapp' | 'email';
type Step = 1 | 2 | 3 | 4;

const BUSINESS_KINDS: BusinessKind[] = ['hospitality', 'beauty', 'shop', 'other'];
const NEED_KINDS: NeedKind[] = ['new-site', 'redesign', 'bookings', 'menu', 'other'];

/**
 * nuevo_proyecto interactive wizard.
 * Three steps (business → needs → contact) + a summary with a prefilled
 * WhatsApp or email link. Mounted only in JS mode via BusinessApp.
 */
export function Wizard() {
  const t = useTranslations('os');

  // Build a full-key translator that message.ts expects (keys like "os.wizard.business.hospitality").
  const tFull = (key: string, values?: Record<string, string>): string => {
    const stripped = key.startsWith('os.') ? key.slice(3) : key;
    return t(stripped as Parameters<typeof t>[0], values as Parameters<typeof t>[1]);
  };

  const [step, setStep] = useState<Step>(1);
  const [business, setBusiness] = useState<BusinessKind | null>(null);
  const [needs, setNeeds] = useState<Set<NeedKind>>(new Set());
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');

  // Focus the new step's heading after each navigation (but not on first render).
  const stepHeadingRef = useRef<HTMLElement | null>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  const isValid: Record<Step, boolean> = {
    1: business !== null,
    2: needs.size > 0,
    3: true,
    4: true,
  };

  const toggleNeed = (need: NeedKind) => {
    setNeeds((prev) => {
      const next = new Set(prev);
      if (next.has(need)) {
        next.delete(need);
      } else {
        next.add(need);
      }
      return next;
    });
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 4) as Step);
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const message = business
    ? buildProjectMessage(
        { business, needs: [...needs], name, details },
        tFull,
      )
    : '';

  const href =
    channel === 'whatsapp'
      ? whatsappHref(message)
      : mailtoHref(t('wizard.emailSubject'), message);

  const sendLabel =
    channel === 'whatsapp' ? t('wizard.send.whatsapp') : t('wizard.send.email');

  return (
    <div data-wizard className="os-wizard">
      {/* ── Step 1: business kind ─────────────────────────────────────── */}
      {step === 1 && (
        <div data-wizard-step="1">
          <fieldset className="os-wizard-fieldset">
            <legend
              ref={(el) => { stepHeadingRef.current = el; }}
              tabIndex={-1}
              className="os-wizard-legend"
            >
              {t('wizard.step1')}
            </legend>
            <div className="os-wizard-radios">
              {BUSINESS_KINDS.map((kind) => (
                <label key={kind} className="os-wizard-radio-label">
                  <input
                    type="radio"
                    name="business"
                    value={kind}
                    checked={business === kind}
                    onChange={() => setBusiness(kind)}
                    className="os-wizard-radio"
                  />
                  <span>{t(`wizard.business.${kind}` as Parameters<typeof t>[0])}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <WizardNav
            onBack={goBack}
            onNext={goNext}
            backDisabled={true}
            nextDisabled={!isValid[1]}
            backLabel={t('wizard.back')}
            nextLabel={t('wizard.next')}
          />
        </div>
      )}

      {/* ── Step 2: needs ────────────────────────────────────────────── */}
      {step === 2 && (
        <div data-wizard-step="2">
          <fieldset className="os-wizard-fieldset">
            <legend
              ref={(el) => { stepHeadingRef.current = el; }}
              tabIndex={-1}
              className="os-wizard-legend"
            >
              {t('wizard.step2')}
            </legend>
            <div className="os-wizard-checks">
              {NEED_KINDS.map((kind) => (
                <label key={kind} className="os-wizard-check-label">
                  <input
                    type="checkbox"
                    name="needs"
                    value={kind}
                    checked={needs.has(kind)}
                    onChange={() => toggleNeed(kind)}
                    className="os-wizard-checkbox"
                  />
                  <span>{t(`wizard.needs.${kind === 'new-site' ? 'newSite' : kind}` as Parameters<typeof t>[0])}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <WizardNav
            onBack={goBack}
            onNext={goNext}
            backDisabled={false}
            nextDisabled={!isValid[2]}
            backLabel={t('wizard.back')}
            nextLabel={t('wizard.next')}
          />
        </div>
      )}

      {/* ── Step 3: name, details, channel ───────────────────────────── */}
      {step === 3 && (
        <div data-wizard-step="3">
          <p
            ref={(el) => { stepHeadingRef.current = el; }}
            tabIndex={-1}
            className="os-wizard-legend"
          >
            {t('wizard.step3')}
          </p>
          <div className="os-wizard-fields">
            <label className="os-wizard-field-label">
              <span className="os-wizard-label-text">{t('wizard.nameLabel')}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="os-wizard-text"
                autoComplete="name"
              />
            </label>
            <label className="os-wizard-field-label">
              <span className="os-wizard-label-text">{t('wizard.detailsLabel')}</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={4}
                className="os-wizard-textarea"
              />
            </label>
            <fieldset className="os-wizard-fieldset">
              <legend className="os-wizard-label-text">{t('wizard.channelTitle')}</legend>
              <div className="os-wizard-radios os-wizard-radios--row">
                <label className="os-wizard-radio-label">
                  <input
                    type="radio"
                    name="channel"
                    value="whatsapp"
                    checked={channel === 'whatsapp'}
                    onChange={() => setChannel('whatsapp')}
                    className="os-wizard-radio"
                  />
                  <span>{t('wizard.channelWhatsapp')}</span>
                </label>
                <label className="os-wizard-radio-label">
                  <input
                    type="radio"
                    name="channel"
                    value="email"
                    checked={channel === 'email'}
                    onChange={() => setChannel('email')}
                    className="os-wizard-radio"
                  />
                  <span>{t('wizard.channelEmail')}</span>
                </label>
              </div>
            </fieldset>
          </div>
          <WizardNav
            onBack={goBack}
            onNext={goNext}
            backDisabled={false}
            nextDisabled={false}
            backLabel={t('wizard.back')}
            nextLabel={t('wizard.next')}
          />
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────────────── */}
      {step === 4 && (
        <div data-wizard-step="4">
          <p
            ref={(el) => { stepHeadingRef.current = el; }}
            tabIndex={-1}
            className="os-wizard-legend"
          >
            {t('wizard.summaryTitle')}
          </p>
          <pre className="os-wizard-message">{message}</pre>
          <div className="os-wizard-send">
            <a href={href} className="os-button os-wizard-send-btn">
              {sendLabel}
            </a>
          </div>
          <div className="os-wizard-nav">
            <button type="button" className="os-wizard-btn" onClick={goBack}>
              {t('wizard.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Navigation controls ───────────────────────────────────────────────────

type NavProps = {
  onBack: () => void;
  onNext: () => void;
  backDisabled: boolean;
  nextDisabled: boolean;
  backLabel: string;
  nextLabel: string;
};

function WizardNav({ onBack, onNext, backDisabled, nextDisabled, backLabel, nextLabel }: NavProps) {
  return (
    <div className="os-wizard-nav">
      <button type="button" className="os-wizard-btn" onClick={onBack} disabled={backDisabled}>
        {backLabel}
      </button>
      <button type="button" className="os-wizard-btn os-wizard-btn--primary" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </button>
    </div>
  );
}
