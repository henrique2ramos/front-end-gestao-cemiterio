import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './HelpPage.module.css';

const CONTATO = {
    telefone: '(00) 0000-0000',
    horario: 'Segunda a sexta, das 8h às 17h',
    endereco: 'Endereço do atendimento, Pirpirituba',
};

const GRUPOS = [
    {
        titulo: 'Sobre quem partiu',
        itens: [
            'Certidão de óbito, emitida pelo cartório',
            'Documento de identificação (RG ou CPF), se estiver à mão',
        ],
    },
    {
        titulo: 'Sobre você',
        itens: [
            'Um documento seu, com foto e CPF',
            'Um telefone para contato',
            'Comprovante de parentesco, quando for necessário',
        ],
    },
    {
        titulo: 'Se a família já tem um local',
        itens: [
            'Documento ou título do jazigo, se houver',
            'Autorização do titular, caso ele não possa comparecer',
        ],
    },
];

const PERGUNTAS = [
    {
        pergunta: 'Perdi ou não tenho algum documento. E agora?',
        resposta:
            'Fique tranquilo(a). Muitas vezes é possível resolver com uma segunda via ou outro comprovante. Fale com a gente e vamos ver juntos o melhor caminho.',
    },
    {
        pergunta: 'Outra pessoa pode resolver isso por mim?',
        resposta:
            'Em geral, sim. Outro familiar ou a funerária podem cuidar da documentação. Converse conosco antes, para sabermos o que ela deve levar.',
    },
    {
        pergunta: 'Existe alguma taxa?',
        resposta:
            'Pode haver taxas municipais, dependendo do atendimento. Ligue para a gente e informaremos os valores atuais.',
    },
    {
        pergunta: 'Quero encontrar um jazigo ou uma homenagem.',
        resposta: 'Você pode procurar pelo nome ou localizar o espaço no mapa.',
        links: [
            { to: '/falecidos', rotulo: 'Ver falecidos' },
            { to: '/mapa', rotulo: 'Abrir o mapa' },
        ],
    },
];

export default function HelpPage() {
    const [marcados, setMarcados] = useState({});

    function alternar(chave) {
        setMarcados((atual) => ({ ...atual, [chave]: !atual[chave] }));
    }

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroContent}>
                    <span className={styles.heroLabel}>Estamos com você</span>
                    <h1 className={styles.heroTitle}>Como podemos ajudar</h1>
                    <p className={styles.heroText}>
                        Sentimos muito pela sua perda. Reunimos aqui o que costuma ser necessário.
                    </p>
                </div>
            </header>

            <div className={styles.layout}>
                <div className={styles.main}>
                    <article className={styles.sheet}>
                        <h2 className={styles.sheetTitle}>O que costuma ser necessário</h2>
                        <p className={styles.sheetIntro}>
                            Você não precisa resolver tudo de uma vez. Leve o que conseguir e, se algo faltar, a gente
                            encontra uma solução juntos. Se quiser, vá marcando o que já separou.
                        </p>

                        {GRUPOS.map(({ titulo, itens }) => (
                            <section key={titulo} className={styles.group}>
                                <h3 className={styles.groupTitle}>{titulo}</h3>
                                <ul className={styles.checklist}>
                                    {itens.map((item, i) => {
                                        const chave = `${titulo}-${i}`;
                                        const ativo = !!marcados[chave];
                                        return (
                                            <li key={chave}>
                                                <label className={ativo ? styles.done : ''}>
                                                    <input
                                                        type="checkbox"
                                                        checked={ativo}
                                                        onChange={() => alternar(chave)}
                                                    />
                                                    <span className={styles.box} aria-hidden="true" />
                                                    <span>{item}</span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}

                        <p className={styles.sheetNote}>
                            Se você já está com a funerária, ela costuma orientar e cuidar de boa parte disso.
                        </p>
                    </article>

                    <section className={styles.faqBlock}>
                        <h2 className={styles.faqTitle}>Dúvidas que costumam surgir</h2>
                        {PERGUNTAS.map(({ pergunta, resposta, links }) => (
                            <details key={pergunta} className={styles.faqItem}>
                                <summary>{pergunta}</summary>
                                <p>{resposta}</p>
                                {links && (
                                    <p className={styles.faqLinks}>
                                        {links.map((link) => (
                                            <Link key={link.to} to={link.to}>
                                                {link.rotulo}
                                            </Link>
                                        ))}
                                    </p>
                                )}
                            </details>
                        ))}
                    </section>
                </div>

                <aside className={styles.aside}>
                    <h2 className={styles.asideTitle}>Prefere conversar?</h2>
                    <p className={styles.asideText}>Será um prazer atender você, sem pressa.</p>
                    <p className={styles.asideContact}>
                        <strong>{CONTATO.telefone}</strong>
                        <br />
                        {CONTATO.horario}
                        <br />
                        {CONTATO.endereco}
                    </p>
                </aside>
            </div>
        </div>
    );
}