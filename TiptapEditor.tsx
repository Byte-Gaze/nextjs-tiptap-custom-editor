"use client";

import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import styles from './TiptapEditor.module.css';
import {
    FaBold, FaItalic, FaStrikethrough, FaCode, FaParagraph,
    FaHeading, FaListUl, FaListOl, FaQuoteRight, FaUndo, FaRedo, FaMarkdown, FaImage, FaFileCode,
    FaTable, FaTrash, FaMinus, FaCheckSquare, FaEraser, FaLink, FaUnlink, FaHighlighter
} from 'react-icons/fa';
import { BiMerge, BiGridAlt } from "react-icons/bi";
import {
    RiInsertRowBottom, RiInsertColumnRight,
    RiDeleteRow, RiDeleteColumn
} from "react-icons/ri";
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';

const lowlight = createLowlight(all);

const CaptionExtension = Extension.create({
    name: 'caption-v2',
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    decorations: (state) => {
                        const decorations: Decoration[] = [];
                        const { doc } = state;

                        doc.descendants((node, pos) => {
                            if (node.type.name === 'paragraph') {
                                const text = node.textContent;
                                // Match paragraphs wrapping in ^^^ ... ^^^
                                // Allow optional whitespace around inner text: ^^^ text ^^^
                                const match = text.match(/^\^\^\^(.*?)\^\^\^$/);
                                if (match) {
                                    // 1. Style the whole paragraph
                                    decorations.push(
                                        Decoration.node(pos, pos + node.nodeSize, {
                                            class: styles.captionStyle,
                                        })
                                    );

                                    // 2. Hide the leading '^^^'
                                    decorations.push(
                                        Decoration.inline(pos + 1, pos + 4, {
                                            class: styles.hiddenMarker,
                                        })
                                    );

                                    // 3. Hide the trailing '^^^'
                                    // node.nodeSize includes tags. Text length is node.content.size or text.length.
                                    // pos + 1 is start of text.
                                    // End of text is pos + 1 + text.length.
                                    // Trailing ^^^ is at [end - 3, end]
                                    const endPos = pos + 1 + text.length;
                                    decorations.push(
                                        Decoration.inline(endPos - 3, endPos, {
                                            class: styles.hiddenMarker,
                                        })
                                    );
                                }
                            }
                        });

                        return DecorationSet.create(doc, decorations);
                    },
                },
            }),
        ];
    },
});

interface MenuBarProps {
    editor: Editor | null;
    showMarkdown: boolean;
    toggleMarkdown: () => void;
    onImageUpload?: (file: File) => Promise<string>;
}

const MenuBar = ({ editor, showMarkdown, toggleMarkdown, onImageUpload }: MenuBarProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showTableModal, setShowTableModal] = useState(false);
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(3);

    const [showImageModal, setShowImageModal] = useState(false);
    const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
    const [imageAlt, setImageAlt] = useState('');
    const [imageUrlInput, setImageUrlInput] = useState('');

    // New states for improved UX
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Link Modal State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const openImageModal = () => {
        setImageAlt('');
        setImageUrlInput('');
        setImageTab('upload');
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsUploading(false);
        setIsDragging(false);
        setShowImageModal(true);
    };

    const handleFileSelectConfig = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleInsertImage = async () => {
        if (imageTab === 'upload') {
            if (!selectedFile) return;

            if (onImageUpload) {
                setIsUploading(true);
                try {
                    const url = await onImageUpload(selectedFile);
                    if (url) {
                        editor?.chain().focus().setImage({ src: url, alt: imageAlt }).run();
                        setShowImageModal(false);
                    }
                } catch (error) {
                    console.error("Image upload failed", error);
                    alert("이미지 업로드 실패");
                } finally {
                    setIsUploading(false);
                }
            }
        } else {
            // URL mode
            if (imageUrlInput && imageUrlInput.trim() !== '') {
                editor?.chain().focus().setImage({ src: imageUrlInput, alt: imageAlt }).run();
                setShowImageModal(false);
            }
        }
    };

    const removeSelectedImage = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const openLinkModal = () => {
        const previousUrl = editor?.getAttributes('link').href;
        setLinkUrl(previousUrl || '');
        setShowLinkModal(true);
    };

    const handleInsertLink = () => {
        if (linkUrl === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            // Check if protocol exists, if not default to https:// (basic check)
            let finalUrl = linkUrl;
            if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('/')) {
                finalUrl = 'https://' + finalUrl;
            }
            editor?.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
        }
        setShowLinkModal(false);
    };

    const unsetLink = () => {
        editor?.chain().focus().unsetLink().run();
    };

    const handleInsertTable = () => {
        editor?.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
        setShowTableModal(false);
        // Reset defaults
        setTableRows(3);
        setTableCols(3);
    };

    if (!editor) {
        return null;
    }



    return (
        <div className={styles.menuBar}>
            {/* History Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().undo().run()}
                    title="실행 취소"
                >
                    <FaUndo />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().redo().run()}
                    title="다시 실행"
                >
                    <FaRedo />
                </button>
            </div>

            <div className={styles.divider} />

            {/* Heading & Paragraph Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setParagraph().run()}
                    disabled={showMarkdown}
                    className={editor.isActive('paragraph') ? styles.isActive : ''}
                    title="문단"
                >
                    <FaParagraph />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    disabled={showMarkdown}
                    className={editor.isActive('heading', { level: 1 }) ? styles.isActive : ''}
                    title="제목 1"
                >
                    <FaHeading />1
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    disabled={showMarkdown}
                    className={editor.isActive('heading', { level: 2 }) ? styles.isActive : ''}
                    title="제목 2"
                >
                    <FaHeading />2
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    disabled={showMarkdown}
                    className={editor.isActive('heading', { level: 3 }) ? styles.isActive : ''}
                    title="제목 3"
                >
                    <FaHeading />3
                </button>
            </div>

            <div className={styles.divider} />

            {/* Formatting Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? styles.isActive : ''}
                    title="굵게"
                >
                    <FaBold />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? styles.isActive : ''}
                    title="기울임"
                >
                    <FaItalic />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().toggleStrike().run()}
                    className={editor.isActive('strike') ? styles.isActive : ''}
                    title="취소선"
                >
                    <FaStrikethrough />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().toggleHighlight().run()}
                    className={editor.isActive('highlight') ? styles.isActive : ''}
                    title="형광펜 (Highlights)"
                >
                    <FaHighlighter />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().toggleCode().run()}
                    className={editor.isActive('code') ? styles.isActive : ''}
                    title="인라인 코드"
                >
                    <FaCode />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    disabled={showMarkdown}
                    title="서식 지우기"
                >
                    <FaEraser />
                </button>
            </div>


            <div className={styles.divider} />

            {/* Lists Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    disabled={showMarkdown}
                    className={editor.isActive('bulletList') ? styles.isActive : ''}
                    title="글머리 기호 목록"
                >
                    <FaListUl />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    disabled={showMarkdown}
                    className={editor.isActive('orderedList') ? styles.isActive : ''}
                    title="번호 매기기 목록"
                >
                    <FaListOl />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    disabled={showMarkdown}
                    className={editor.isActive('taskList') ? styles.isActive : ''}
                    title="체크리스트"
                >
                    <FaCheckSquare />
                </button>
            </div>

            <div className={styles.divider} />

            {/* Block & Inserts Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    disabled={showMarkdown}
                    className={editor.isActive('blockquote') ? styles.isActive : ''}
                    title="인용구"
                >
                    <FaQuoteRight />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    disabled={showMarkdown || !editor.can().chain().focus().toggleCodeBlock().run()}
                    className={editor.isActive('codeBlock') ? styles.isActive : ''}
                    title="코드 블록"
                >
                    <FaFileCode />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    disabled={showMarkdown}
                    title="구분선"
                >
                    <FaMinus />
                </button>
            </div>

            <div className={styles.divider} />

            {/* Table Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={() => setShowTableModal(true)}
                    disabled={showMarkdown || editor.isActive('table')}
                    title={editor.isActive('table') ? "표 내부에서는 표를 생성할 수 없습니다" : "표 삽입"}
                >
                    <FaTable />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    disabled={showMarkdown || !editor.isActive('table')}
                    title="행 추가 (아래)"
                >
                    <RiInsertRowBottom />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    disabled={showMarkdown || !editor.isActive('table')}
                    title="열 추가 (오른쪽)"
                >
                    <RiInsertColumnRight />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    disabled={showMarkdown || !editor.isActive('table')}
                    title="행 삭제"
                >
                    <RiDeleteRow />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    disabled={showMarkdown || !editor.isActive('table')}
                    title="열 삭제"
                >
                    <RiDeleteColumn />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    disabled={showMarkdown || !editor.isActive('table')}
                    title="표 삭제"
                >
                    <FaTrash />
                </button>
            </div>

            <div className={styles.divider} />

            {/* Link & Image Group */}
            <div className={styles.buttonGroup}>
                <button
                    type="button"
                    onClick={openLinkModal}
                    disabled={showMarkdown || (editor?.state.selection.empty && !editor?.isActive('link'))}
                    className={editor?.isActive('link') ? styles.isActive : ''}
                    title={editor?.state.selection.empty && !editor?.isActive('link') ? "텍스트를 선택해야 링크를 삽입할 수 있습니다" : "링크 삽입"}
                >
                    <FaLink />
                </button>
                <button
                    type="button"
                    onClick={unsetLink}
                    disabled={showMarkdown || !editor.isActive('link')}
                    title="링크 해제"
                >
                    <FaUnlink />
                </button>
                {onImageUpload && (
                    <>
                        <button
                            type="button"
                            onClick={openImageModal}
                            disabled={showMarkdown}
                            title="이미지 삽입"
                        >
                            <FaImage />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </>
                )}
            </div>

            <button
                type="button"
                onClick={toggleMarkdown}
                className={`${showMarkdown ? styles.isActive : ''} ${styles.pushRight}`}
                title="마크다운 모드 전환"
            >
                <FaMarkdown />
            </button>

            {/* Table Creation Modal */}
            {
                showTableModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <h3 className={styles.modalTitle}>표 삽입</h3>
                            <div className={styles.modalInputGroup}>
                                <label>행 (Rows)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={tableRows}
                                    onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className={styles.modalInputGroup}>
                                <label>열 (Columns)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={tableCols}
                                    onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={`${styles.modalButton} ${styles.modalButtonConfirm}`}
                                    onClick={handleInsertTable}
                                >
                                    확인
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                                    onClick={() => setShowTableModal(false)}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Image Insertion Modal */}
            {
                showImageModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <h3 className={styles.modalTitle}>이미지 삽입</h3>

                            <div className={styles.tabGroup}>
                                <button
                                    type="button"
                                    className={`${styles.tabButton} ${imageTab === 'upload' ? styles.activeTab : ''}`}
                                    onClick={() => setImageTab('upload')}
                                >
                                    파일 업로드
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.tabButton} ${imageTab === 'url' ? styles.activeTab : ''}`}
                                    onClick={() => setImageTab('url')}
                                >
                                    이미지 링크
                                </button>
                            </div>

                            <div style={{ flex: 1 }}> {/* Main content area */}
                                {imageTab === 'upload' ? (
                                    <>
                                        {!previewUrl ? (
                                            <div
                                                className={`${styles.dropArea} ${isDragging ? styles.isDragging : ''}`}
                                                onClick={handleFileSelectConfig}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                            >
                                                <FaImage style={{ width: '48px', height: '48px', opacity: 0.5 }} />
                                                <p>클릭 또는 이미지를 드래그하여 놓으세요</p>
                                            </div>
                                        ) : (
                                            <div className={styles.previewContainer}>
                                                <img src={previewUrl} className={styles.imagePreview} alt="Preview" />
                                                <button
                                                    className={styles.removeImageBtn}
                                                    onClick={removeSelectedImage}
                                                    title="이미지 제거"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className={styles.modalInputGroup}>
                                        <label>이미지 주소 (URL)</label>
                                        <input
                                            type="text"
                                            placeholder="https://example.com/image.jpg"
                                            value={imageUrlInput}
                                            onChange={(e) => setImageUrlInput(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                )}

                                <div className={styles.modalInputGroup}>
                                    <label>이미지 설명 (Alt Text)</label>
                                    <input
                                        type="text"
                                        placeholder="이미지 설명을 입력하세요 (선택 사항)"
                                        value={imageAlt}
                                        onChange={(e) => setImageAlt(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={`${styles.modalButton} ${styles.modalButtonConfirm}`}
                                    onClick={handleInsertImage}
                                    disabled={isUploading || (imageTab === 'upload' && !selectedFile) || (imageTab === 'url' && !imageUrlInput)}
                                >
                                    {isUploading ? '업로드 중...' : '확인'}
                                </button>

                                <button
                                    type="button"
                                    className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                                    onClick={() => setShowImageModal(false)}
                                    disabled={isUploading}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Link Insertion Modal */}
            {
                showLinkModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent} style={{ height: 'auto', minHeight: 'auto' }}>
                            <h3 className={styles.modalTitle}>링크 삽입</h3>

                            <div className={styles.modalInputGroup}>
                                <label>링크 주소 (URL)</label>
                                <input
                                    type="text"
                                    placeholder="https://example.com"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInsertLink();
                                    }}
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={`${styles.modalButton} ${styles.modalButtonConfirm}`}
                                    onClick={handleInsertLink}
                                >
                                    확인
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                                    onClick={() => setShowLinkModal(false)}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

interface TiptapEditorProps {
    content: string;
    onChange: (content: string) => void;
    onImageUpload?: (file: File) => Promise<string>;
}

// Configure Marked with a custom extension to handle bold text more permissively
// We define a new extension named 'strong' which Marked prioritizes over the built-in logic.
marked.use({
    extensions: [{
        name: 'strong',
        level: 'inline',
        // Start function hints where the token might start (optimization)
        start(src: string) { return src.match(/\*\*/)?.index; },
        // Tokenizer function parses the source string
        tokenizer(src: string, tokens: any) {
            // Match **content** where content allows single * inside, but stops at **
            // Regex explanation:
            // ^\*\*           : Start with **
            // (               : Capture group 1 (content)
            //   (?:           : Non-capturing group for content alternatives
            //     [^*]        : Any char that is not *
            //     |           : OR
            //     \*(?!\*)    : A * NOT followed by another * (allows nested *italic*)
            //   )+?           : One or more times, non-greedy
            // )               : End content capture
            // \*\*(?!\*)      : End with ** not followed by *
            const match = /^\*\*((?:[^*]|\*(?!\*))+?)\*\*(?!\*)/.exec(src);
            if (match) {
                return {
                    type: 'strong',
                    raw: match[0],
                    text: match[1],
                    // Process nested tokens inside the bold text
                    // @ts-ignore
                    tokens: this.lexer.inlineTokens(match[1])
                };
            }
        }
    }]
});

export default function TiptapEditor({ content, onChange, onImageUpload }: TiptapEditorProps) {
    const [isMarkdownMode, setIsMarkdownMode] = useState(false);
    const [markdownContent, setMarkdownContent] = useState("");

    // Helper services
    const turndownService = useMemo(() => {
        // @ts-ignore
        const service = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            emDelimiter: '_',
            strongDelimiter: '**'
        });
        service.use(gfm); // Use GitHub Flavored Markdown for Tables

        // Keep standard formatting tags to handle them via Regex later 
        // (This bypasses Turndown's occasional failure to bold complex text patterns like 'Supabase Cloud(Free)')
        service.keep(['strong', 'b', 'em', 'i', 'br']);

        // Add rule to handle inline styles for bold (often from copy-paste)
        service.addRule('inlineBold', {
            filter: function (node, options) {
                const style = node.getAttribute ? node.getAttribute('style') : '';
                return node.nodeName === 'SPAN' && /font-weight:\s*(bold|700|800|900)/i.test(style || '');
            },
            replacement: function (content) {
                return '**' + content + '**';
            }
        });

        // Add rule to handle inline styles for italic
        service.addRule('inlineItalic', {
            filter: function (node, options) {
                const style = node.getAttribute ? node.getAttribute('style') : '';
                return node.nodeName === 'SPAN' && /font-style:\s*italic/i.test(style || '');
            },
            replacement: function (content) {
                return '_' + content + '_';
            }
        });

        // Add specific rule for task lists to ensure they are rendered as - [ ] or - [x]
        service.addRule('taskList', {
            filter: function (node) {
                return node.nodeName === 'LI' && node.hasAttribute('data-type') && node.getAttribute('data-type') === 'taskItem';
            },
            replacement: function (content, node) {
                // @ts-ignore
                const isChecked = node.getAttribute('data-checked') === 'true';
                // Trim content to remove newlines caused by block elements (div/p) inside the li
                return (isChecked ? '- [x] ' : '- [ ] ') + content.trim() + '\n';
            }
        });

        service.addRule('taskListContainer', {
            filter: function (node) {
                return node.nodeName === 'UL' && node.hasAttribute('data-type') && node.getAttribute('data-type') === 'taskList';
            },
            replacement: function (content, node) {
                return content;
            }
        });

        // Ignore the label that Tiptap wraps around the checkbox to prevent double rendering
        service.addRule('taskItemLabel', {
            filter: function (node) {
                return node.nodeName === 'LABEL' && (node.parentNode as HTMLElement).getAttribute('data-type') === 'taskItem';
            },
            replacement: function () {
                return '';
            }
        });

        service.addRule('highlight', {
            filter: 'mark',
            replacement: function (content) {
                return '==' + content + '==';
            }
        });



        return service;
    }, []);

    const [, forceUpdate] = useState({});

    const editor = useEditor({
        onSelectionUpdate: () => forceUpdate({}),
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                // @ts-ignore
                link: false, // Disable link if it exists in StarterKit to avoid duplicates
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            Table.configure({
                resizable: false,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Image,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: styles.link, // Apply custom class for editor styling
                },
            }),
            Placeholder.configure({
                placeholder: '내용을 입력하세요...',
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Highlight.configure({
                multicolor: false,
            }),
            CaptionExtension,
        ],
        content: content,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            forceUpdate({});
            if (!isMarkdownMode) {
                onChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: styles.editorContent,
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/') && onImageUpload) {
                        onImageUpload(file).then((url) => {
                            if (url) {
                                const { schema } = view.state;
                                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                                if (coordinates) {
                                    view.dispatch(view.state.tr.insert(coordinates.pos, schema.nodes.image.create({ src: url })));
                                }
                            }
                        });
                        return true;
                    }
                }
                return false;
            }
        },
    });

    const toggleMarkdown = async () => {
        if (!editor) return;

        if (!isMarkdownMode) {
            // HTML -> Markdown
            let html = editor.getHTML();

            // Pre-process HTML specifically for Table compatibility with Turndown/GFM
            if (typeof window !== 'undefined') {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const tables = doc.querySelectorAll('table');

                    tables.forEach(table => {
                        // 1. Remove colgroup (not needed for markdown)
                        const colgroup = table.querySelector('colgroup');
                        if (colgroup) colgroup.remove();

                        // 2. Tiptap puts headers in tbody, but GFM needs thead
                        const tbody = table.querySelector('tbody');
                        if (tbody) {
                            const firstRow = tbody.querySelector('tr');
                            if (firstRow && firstRow.querySelector('th')) {
                                const thead = doc.createElement('thead');
                                thead.appendChild(firstRow);
                                table.insertBefore(thead, tbody);
                            }
                        }

                        // 3. Unwrap <p> tags inside cells to prevent table breakage (p adds newlines)
                        const cells = table.querySelectorAll('th, td');
                        cells.forEach(cell => {
                            const ps = cell.querySelectorAll('p');
                            ps.forEach((p, index) => {
                                const span = doc.createElement('span');
                                span.innerHTML = p.innerHTML;
                                p.parentNode?.replaceChild(span, p);
                                // Add <br> if it's not the last paragraph, though markdown tables have bad support for multiline
                                if (index < ps.length - 1) {
                                    cell.insertBefore(doc.createElement('br'), span.nextSibling);
                                }
                            });
                        });
                    });

                    html = doc.body.innerHTML;
                } catch (e) {
                    console.error("Table post-processing failed", e);
                }
            }

            let md = turndownService.turndown(html);

            // Post-process kept tags to ensure correct Markdown conversion
            // This manually converts kept formatted tags to markdown, bypassing Turndown's internal constraints
            md = md
                .replace(/<strong[^>]*>((?:.|\n)*?)<\/strong>/gi, '**$1**')
                .replace(/<b[^>]*>((?:.|\n)*?)<\/b>/gi, '**$1**')
                .replace(/<em[^>]*>((?:.|\n)*?)<\/em>/gi, '_$1_')
                .replace(/<i[^>]*>((?:.|\n)*?)<\/i>/gi, '_$1_');

            md = md.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
            setMarkdownContent(md);
            setIsMarkdownMode(true);
        } else {
            // Markdown -> HTML
            // Pre-process markdown to support ==highlight== -> <mark>
            let mdContent = markdownContent;
            mdContent = mdContent.replace(/==([^=]+)==/g, '<mark>$1</mark>');

            // We need to parse markdown back to HTML to restore editor state
            const htmlPromise = marked.parse(mdContent, { gfm: true });
            let html = await htmlPromise;

            // Post-process HTML from Marked -> Tiptap
            // Tiptap expects <ul data-type="taskList"><li data-type="taskItem" data-checked="true/false">...</li></ul>
            if (typeof window !== 'undefined') {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // 1. Handle standard GFM checkboxes if marked rendered them ( <input type="checkbox"> )
                    const checkboxes = doc.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(checkbox => {
                        const li = checkbox.closest('li');
                        const ul = li?.closest('ul');

                        if (li && ul) {
                            ul.setAttribute('data-type', 'taskList');
                            li.setAttribute('data-type', 'taskItem');

                            if ((checkbox as HTMLInputElement).checked) {
                                li.setAttribute('data-checked', 'true');
                            } else {
                                li.setAttribute('data-checked', 'false');
                            }
                            // Remove the input, Tiptap will re-create it based on attributes
                            checkbox.remove();
                        }
                    });

                    // 2. Handle text-based checkboxes (fallback for when marked renders them as plain text)
                    // This handles cases like "- [ ] todo" rendered as <li>[ ] todo</li>
                    const listItems = doc.querySelectorAll('li');
                    listItems.forEach(li => {
                        // Skip if already processed in step 1
                        if (li.hasAttribute('data-type')) return;

                        let textContent = li.textContent || '';
                        // Relaxed regex: allow [ ] at end of string or followed by space
                        const taskRegex = /^\s*\[([ xX])\](\s|$)/;

                        // If text content starts with [ ] or [x]
                        if (taskRegex.test(textContent)) {
                            const ul = li.closest('ul');
                            if (ul) ul.setAttribute('data-type', 'taskList');
                            li.setAttribute('data-type', 'taskItem');

                            const match = textContent.match(taskRegex);
                            const isChecked = match ? match[1].toLowerCase() === 'x' : false;
                            li.setAttribute('data-checked', String(isChecked));

                            // Remove the "[ ] " prefix from the text node
                            // We use TreeWalker to find the *first* text node that matches and clean it.
                            const walkers = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, null);
                            let node = walkers.nextNode();
                            while (node) {
                                if (node.textContent && taskRegex.test(node.textContent)) {
                                    node.textContent = node.textContent.replace(taskRegex, '');
                                    break; // Only replace the first occurrence (the marker)
                                }
                                node = walkers.nextNode();
                            }
                        }
                    });

                    html = doc.body.innerHTML;
                } catch (e) {
                    console.error("Markdown post-processing failed", e);
                }
            }


            editor.commands.setContent(html);
            onChange(html); // sync parent
            setIsMarkdownMode(false);
        }
    };

    const handleMarkdownChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setMarkdownContent(val);
        // Sync parent with HTML equivalent (mostly for preview elsewhere or submit check)
        // Also support ==highlight== in pre-processing for sync
        let mdForSync = val.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/==([^=]+)==/g, '<mark>$1</mark>');
        const htmlPromise = marked.parse(mdForSync);
        let html = await htmlPromise;
        onChange(html);
    };

    // Update content if it changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // Only update if content is actually different to avoid cursor jumps/loops
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    return (
        <div className={styles.editorWrapper}>
            <MenuBar
                editor={editor}
                showMarkdown={isMarkdownMode}
                toggleMarkdown={toggleMarkdown}
                onImageUpload={onImageUpload}
            />
            {isMarkdownMode ? (
                <textarea
                    className={styles.markdownArea}
                    value={markdownContent}
                    onChange={handleMarkdownChange}
                />
            ) : (
                <EditorContent editor={editor} className={styles.editorArea} />
            )}
        </div>
    );
}
