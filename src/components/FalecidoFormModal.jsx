import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';
import personPlaceholder from '../assets/person-placeholder.svg';
import styles from './FalecidoFormModal.module.css';

export default function FalecidoFormModal({
    selectedFalecido,
    formData,
    onClose,
    onSubmit,
    onInputChange,
    setFormData,
    datePickerRefs,
    openCalendar,
    dateToInput,
    formatDate,
    quadraOptions,
    loteOptions,
    onQuadraChange,
    onLoteChange,
    imageInputRef,
    onImageUpload,
    imagePreview,
    resolveImage,
    imageRemoved,
    selectedImageFile,
    onRemoveImage,
    onGalleryUpload,
    onRemoveGalleryImage,
    selectedGalleryFiles = [],
    requiredFields = false,
    galleryHelpText = 'Você pode enviar até 10 imagens para a galeria.'
}) {
    const required = requiredFields ? ' *' : '';
    const [uploadedGalleryPreviews, setUploadedGalleryPreviews] = useState([]);
    const [removedExistingGallery, setRemovedExistingGallery] = useState([]);
    const galleryInputRef = useRef(null);

    useEffect(() => {
        const previews = selectedGalleryFiles.map((file) => URL.createObjectURL(file));
        setUploadedGalleryPreviews(previews);
        return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
    }, [selectedGalleryFiles]);

    const existingGallery = Array.isArray(selectedFalecido?.galeria) ? selectedFalecido.galeria.filter(Boolean) : [];
    useEffect(() => setRemovedExistingGallery([]), [selectedFalecido?.id]);
    const removeUploadedGalleryImage = (index) => {
        onRemoveGalleryImage?.(index);
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{selectedFalecido ? 'Editar Falecido' : 'Novo Falecido'}</h2>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                        <X size={24} />
                    </button>
                </div>
                <div className={styles.body}>
                    <form onSubmit={onSubmit} className={styles.formGrid}>
                        <div className={styles.formCol}>
                            <h3 className={styles.sectionTitle}>Dados Pessoais e Localização</h3>
                            <div className={styles.formGroup}>
                                <label>Nome Completo{required}</label>
                                <input type="text" name="nome" placeholder="Ex: Maria Aparecida" required value={formData.nome} onChange={onInputChange} />
                            </div>
                            <div className={styles.formRow}>
                                {[
                                    ['dataNascimento', 'Data de Nascimento', datePickerRefs.birth],
                                    ['dataMorte', 'Data de Falecimento', datePickerRefs.death]
                                ].map(([name, label, ref]) => (
                                    <div className={styles.formGroup} key={name}>
                                        <label>{label}{required}</label>
                                        <div className={styles.dateInputWrap}>
                                            <input className={styles.dateText} type="text" name={name} required={requiredFields} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Use o formato dd/mm/aaaa" placeholder="dd/mm/aaaa" inputMode="numeric" value={formData[name]} onChange={onInputChange} />
                                            <button type="button" className={styles.datePickerButton} aria-label={`Abrir calendário para ${label.toLowerCase()}`} onClick={() => openCalendar(ref)}><CalendarDays size={18} /></button>
                                            <input ref={ref} className={styles.nativeDatePicker} type="date" aria-label={`Selecionar ${label.toLowerCase()} no calendário`} tabIndex={-1} value={dateToInput(formData[name])} onChange={(event) => setFormData((current) => ({ ...current, [name]: formatDate(event.target.value) }))} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                    <label>Quadra{required}</label>
                                    <AutocompleteInput name="setor" value={formData.setor} options={quadraOptions} placeholder="Digite ou selecione a quadra" ariaLabel="Quadra" required={requiredFields} onChange={onQuadraChange} />
                                </div>
                            <div className={styles.formGroup}>
                                    <label>Lote{required}</label>
                                    <AutocompleteInput name="lote" value={formData.lote} options={loteOptions} placeholder="Digite ou selecione o lote" ariaLabel="Lote" required={requiredFields} onChange={onLoteChange} />
                                </div>
                            </div>
                                <div className={styles.formGroup}>
                                <label>Categoria (Tipo){required}</label>
                                <select name="tipo" required={requiredFields} value={formData.tipo} onChange={onInputChange}>
                                    <option value="historica">Personalidade Histórica</option>
                                    <option value="recente">Falecido Recente</option>
                                </select>
                            </div>
                                <div className={styles.formGroup}>
                                <label>Imagem de Perfil</label>
                                <div className={styles.fileInputWrapper}>
                                    <input ref={imageInputRef} type="file" accept="image/*" onChange={onImageUpload} />
                                </div>
                                <small className={styles.inputHelp}>Escolha uma foto principal do computador.</small>
                                <div className={styles.profileImagePreview}>
                                    <img src={resolveImage(imagePreview) || personPlaceholder} alt={imagePreview ? 'Prévia da imagem do memorial' : 'Imagem padrão enquanto nenhuma foto for selecionada'} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                                    {!imageRemoved && (selectedImageFile || (imagePreview && imagePreview !== personPlaceholder) || (selectedFalecido?.imagem && selectedFalecido.imagem !== personPlaceholder)) && (
                                        <button type="button" className={styles.removeImageBtn} aria-label="Remover imagem de perfil" title="Remover imagem" onClick={onRemoveImage}><X size={16} /></button>
                                    )}
                                </div>
                            </div>
                                <div className={styles.formGroup}>
                                <label>Fotos da Galeria</label>
                                <div className={styles.fileInputWrapper}>
                                    <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={onGalleryUpload} />
                                </div>
                                <small className={styles.inputHelp}>{galleryHelpText}</small>
                                {(existingGallery.length > 0 || uploadedGalleryPreviews.length > 0) && (
                                    <div className={styles.galleryPreview} aria-label="Prévia das fotos da galeria">
                                        {existingGallery.map((src, index) => removedExistingGallery.includes(index) ? null : (
                                            <div key={`existing-gallery-${index}`} className={styles.galleryPreviewItem}>
                                                <img src={resolveImage(src)} alt={`Foto ${index + 1} da galeria`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = personPlaceholder; }} />
                                                <button type="button" className={styles.removeImageBtn} aria-label={`Remover foto ${index + 1} da galeria`} title="Remover foto da prévia" onClick={() => setRemovedExistingGallery((current) => [...current, index])}><X size={15} /></button>
                                            </div>
                                        ))}
                                        {uploadedGalleryPreviews.map((src, index) => (
                                            <div key={`new-gallery-${index}`} className={styles.galleryPreviewItem}>
                                                <img src={src} alt={`Prévia da foto ${index + 1} selecionada para a galeria`} />
                                                <button type="button" className={styles.removeImageBtn} aria-label={`Remover foto ${index + 1} da galeria`} title="Remover foto" onClick={() => removeUploadedGalleryImage(index)}><X size={15} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={styles.formCol}>
                            <h3 className={styles.sectionTitle}>Biografia e Detalhes</h3>
                            <div className={styles.formGroup}>
                                <label>Breve Descrição</label>
                                <textarea name="descricao" rows="2" placeholder="Uma frase curta que resuma a pessoa..." value={formData.descricao} onChange={onInputChange} />
                                <small className={styles.inputHelp}>Opcional. Se ficar em branco, a descrição não será exibida.</small>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Biografia Completa</label>
                                <textarea name="biografia" rows="8" placeholder="Escreva a história completa do falecido aqui..." value={formData.biografia} onChange={onInputChange} />
                                <small className={styles.inputHelp}>Opcional. Se não houver informação, o memorial mostrará “Biografia não informada”.</small>
                            </div>
                        </div>
                        <div className={styles.actions}>
                            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
                            <button type="submit" className={styles.saveBtn}>Salvar Registro</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
