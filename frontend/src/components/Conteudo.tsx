/** Exibe imagens Markdown sem interpretar HTML fornecido pela fonte. */
export default function Conteudo({ texto }: { texto: string }) {
  const partes = texto.split(/(!\[[^\]]*\]\(https?:\/\/[^\s)]+\))/g);
  return <div className="conteudo">{partes.map((parte, i) => {
    const imagem = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/.exec(parte);
    return imagem ? <img key={i} src={imagem[2]} alt={imagem[1] || 'Imagem da questão'} loading="lazy" referrerPolicy="no-referrer" />
      : <span key={i}>{parte}</span>;
  })}</div>;
}
