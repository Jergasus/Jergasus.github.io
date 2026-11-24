import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { OpenAppButton } from '../OpenApp';
import { Identity } from './Identity';

/**
 * bienvenida.txt: a short guide — who, one line, a question and three ways in.
 * Rendered once on the server and placed in both the desktop window and the
 * phone home card.
 *
 * Rule: no `id` attribute anywhere inside (the node may render twice).
 */
export async function WelcomeApp({ locale }: { locale: Locale }) {
  const [tHero, tContact, tApps, tWelcome] = await Promise.all([
    getTranslations({ locale, namespace: 'hero' }),
    getTranslations({ locale, namespace: 'contact' }),
    getTranslations({ locale, namespace: 'os.apps' }),
    getTranslations({ locale, namespace: 'welcome' }),
  ]);

  return (
    <div data-welcome className="os-welcome">
      {/* 1. Identity */}
      <div data-welcome-part="identity" className="os-about">
        <Identity locale={locale} />
      </div>

      {/* 2. Line — one sentence, always visible. */}
      <p data-welcome-part="line">{tHero('lede')}</p>

      {/* 3. Question */}
      <h3 data-welcome-part="question">{tWelcome('question')}</h3>

      {/* 4. Actions — buttons need JS; anchors serve document mode. */}
      <div data-welcome-part="actions">
        <OpenAppButton app="projects" className="os-button os-js-only">
          {tWelcome('seeProjects')}
        </OpenAppButton>
        <a href="#projects" className="os-button os-nojs-only">
          {tWelcome('seeProjects')}
        </a>
        <OpenAppButton app="about" className="os-button os-js-only">
          {tApps('about.label')}
        </OpenAppButton>
        <a href="#about" className="os-button os-nojs-only">
          {tApps('about.label')}
        </a>
        <OpenAppButton app="contact" className="os-button os-js-only">
          {tContact('heading')}
        </OpenAppButton>
        <a href="#contact" className="os-button os-nojs-only">
          {tContact('heading')}
        </a>
      </div>

      {/* 5. Explore — hidden in document mode; not relevant without JS. */}
      <div data-welcome-part="explore" className="os-js-only">
        <p data-shell="desktop">{tWelcome('explore')}</p>
        <p data-shell="phone">{tWelcome('explorePhone')}</p>
      </div>
    </div>
  );
}
