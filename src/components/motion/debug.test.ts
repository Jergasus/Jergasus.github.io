import { describe, expect, it } from 'vitest';
import { tweenedProperties } from './debug';

describe('tweenedProperties', () => {
  it('keeps target properties and drops GSAP config', () => {
    const vars = {
      yPercent: 100,
      opacity: 0,
      duration: 0.8,
      ease: 'power4.inOut',
      stagger: 0.1,
      delay: 0.3,
      immediateRender: true,
      runBackwards: true,
      scrollTrigger: { trigger: 'section', once: true },
      onComplete: () => {},
      onCompleteParams: [],
      parent: {},
      id: 'reveal',
    };
    expect(tweenedProperties(vars).sort()).toEqual(['opacity', 'yPercent']);
  });

  it('includes the from-values of a fromTo tween', () => {
    expect(tweenedProperties({ scaleX: 1, startAt: { scaleX: 0, rotation: 0 } }).sort()).toEqual([
      'rotation',
      'scaleX',
      'scaleX',
    ]);
  });

  it('reports properties GSAP would animate outside the allowlist', () => {
    // Nothing is hidden by the filter: anything that is not GSAP config shows up.
    expect(tweenedProperties({ height: 'auto', autoAlpha: 1, clearProps: 'all' }).sort()).toEqual([
      'autoAlpha',
      'clearProps',
      'height',
    ]);
  });
});
