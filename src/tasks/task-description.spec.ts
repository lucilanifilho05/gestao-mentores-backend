import { sanitizeTaskDescription } from './task-description';

describe('sanitizeTaskDescription', () => {
  it('preserva somente a formataÃ§Ã£o permitida', () => {
    expect(
      sanitizeTaskDescription(
        '<p>Texto <strong>importante</strong> <em>agora</em></p><ul><li>Item</li></ul>',
      ),
    ).toBe(
      '<p>Texto <strong>importante</strong> <em>agora</em></p><ul><li>Item</li></ul>',
    );
  });

  it('remove scripts, atributos e tags nÃ£o permitidas', () => {
    expect(
      sanitizeTaskDescription(
        '<p class="x" onclick="alert(1)">Seguro<img src=x onerror=alert(1)></p><script>alert(1)</script>',
      ),
    ).toBe('<p>Seguro</p>');
  });

  it('mantÃ©m descriÃ§Ãµes antigas em texto simples', () => {
    expect(sanitizeTaskDescription('Primeira linha\nSegunda linha')).toBe(
      'Primeira linha\nSegunda linha',
    );
  });

  it('normaliza conteÃºdo vazio como nulo', () => {
    expect(sanitizeTaskDescription('<p><br></p>')).toBeNull();
  });
});
