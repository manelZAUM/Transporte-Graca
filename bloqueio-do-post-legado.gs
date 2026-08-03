/**
 * Use este bloco SOMENTE na implantacao publica antiga, enquanto as paginas
 * consulta.html e onibus-*.html ainda dependerem do doGet antigo.
 *
 * Substitua o doPost antigo inteiro por esta funcao. Ela impede que alguem
 * continue usando a URL antiga para alterar ou excluir dados.
 */
function doPost() {
  return ContentService
    .createTextOutput(JSON.stringify({
      sucesso: false,
      erro: 'Esta operacao foi desativada. Use o novo fluxo seguro.',
      codigo: 'API_LEGADA_SOMENTE_LEITURA'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
