import { describe, it } from 'node:test';
import { cn } from './utils';

// Un bloc describe permet de regrouper des tests pour une même fonction ou module
// Ici, on teste la fonction utilitaire "cn" qui fusionne des classes CSS

describe('cn', () => {
  // Premier test : vérifier la fusion de deux classes simples
  it('fusionne deux classes CSS', () => {
    // On attend que cn('a', 'b') retourne "a b"
    expect(cn('a', 'b')).toBe('a b');
  });

  // Deuxième test : ignorer les valeurs falsy (null, undefined, false)
  it('ignore les valeurs falsy', () => {
    // On attend que cn('a', null, undefined, false, 'b') retourne "a b"
    expect(cn('a', null, undefined, false, 'b')).toBe('a b');
  });

  // Troisième test : gère les classes conditionnelles (objets)
  it('gère les objets pour les classes conditionnelles', () => {
    // On attend que cn({ 'a': true, 'b': false }, 'c') retourne "a c"
    expect(cn({ 'a': true, 'b': false }, 'c')).toBe('a c');
  });

  // Quatrième test : fusionne des classes tailwind redondantes intelligemment
  it('fusionne intelligemment les classes tailwind', () => {
    // tailwind-merge doit garder la dernière valeur pour les classes conflictuelles
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});


// Chaque test est commenté pour t'aider à comprendre la logique et la syntaxe.
// Tu peux t'inspirer de cette structure pour tester d'autres fonctions ou composants ! 