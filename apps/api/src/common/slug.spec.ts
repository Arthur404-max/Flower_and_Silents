import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slugify } from './slug';

describe('slugify', () => {
  it('транслитерирует русские названия', () => {
    assert.equal(slugify('Нежное утро'), 'nezhnoe-utro');
    assert.equal(slugify('ЦветоТишина — Подарки'), 'tsvetotishina-podarki');
  });

  it('удаляет лишние разделители и ограничивает длину', () => {
    assert.equal(slugify('  Розы!!!  '), 'rozy');
    assert.equal(slugify('я'.repeat(100)).length, 70);
  });
});
