import { sanitizeTaskDescription } from './task-description';

describe('sanitizeTaskDescription', () => {
  it('preserva somente a formatação permitida', () => {
    expect(
      sanitizeTaskDescription(
        '<p>Texto <strong>importante</strong> <em>agora</em></p><ul><li>Item</li></ul>',
      ),
    ).toBe(
      '<p>Texto <strong>importante</strong> <em>agora</em></p><ul><li>Item</li></ul>',
    );
  });

  it('remove scripts, atributos e tags não permitidas', () => {
    expect(
      sanitizeTaskDescription(
        '<p class="x" onclick="alert(1)">Seguro<img src=x onerror=alert(1)></p><script>alert(1)</script>',
      ),
    ).toBe('<p>Seguro</p>');
  });

  it('mantém descrições antigas em texto simples', () => {
    expect(sanitizeTaskDescription('Primeira linha\nSegunda linha')).toBe(
      'Primeira linha\nSegunda linha',
    );
  });

  it('normaliza conteúdo vazio como nulo', () => {
    expect(sanitizeTaskDescription('<p><br></p>')).toBeNull();
  });

  it('preserva imagem HTTPS com texto alternativo', () => {
    const resultado = sanitizeTaskDescription(
      '<img src="https://exemplo.com/imagem.png" alt="Descrição da imagem">',
    );

    expect(resultado).toContain('src="https://exemplo.com/imagem.png"');
    expect(resultado).toContain('alt="Descrição da imagem"');
  });

  it('remove imagens sem texto alternativo ou com protocolo inseguro', () => {
    expect(
      sanitizeTaskDescription(
        '<img src="https://exemplo.com/sem-alt.png"><img src="data:image/png;base64,abc" alt="Imagem"><img src="javascript:alert(1)" alt="Imagem">',
      ),
    ).toBeNull();
  });

  it('limita as observações a cinco imagens', () => {
    const imagens = Array.from(
      { length: 7 },
      (_, index) =>
        `<img src="https://exemplo.com/${index}.png" alt="Imagem ${index}">`,
    ).join('');

    const resultado = sanitizeTaskDescription(imagens) ?? '';

    expect(resultado.match(/<img\b/g)).toHaveLength(5);
    expect(resultado).not.toContain('https://exemplo.com/5.png');
  });
});
