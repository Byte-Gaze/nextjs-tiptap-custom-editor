# Custom Tiptap Editor

A feature-rich WYSIWYG editor built with [Tiptap](https://tiptap.dev) and [Next.js](https://nextjs.org), designed for seamless integration into React applications. It provides a robust writing experience with built-in support for GitHub Flavored Markdown (GFM), image uploads, and code syntax highlighting.

## Features

-   **Rich Text & Markdown Toggle**: Switch between a visual WYSIWYG interface and raw Markdown editing mode without losing content.
-   **GitHub Flavored Markdown (GFM)**: Full support for tables, task lists, strikethrough, and auto-linking.
-   **Theme-Adaptive UI**: The editor automatically respects your project's CSS variables (e.g., `--background`, `--primary`) for full light/dark mode compatibility.
-   **Advanced Image Management**:
    -   Drag and drop support for image uploads.
    -   Tabbed interface for file uploads vs. URL insertion.
    -   Instant image previews with accessibility (alt text) controls.
-   **Tables**: Insert and manage tables with a dedicated GUI (add/remove rows and columns).
-   **Code Syntax Highlighting**: Automatic syntax highlighting for code blocks using `lowlight`.
-   **Custom Captions**: Support for centered image captions using the `^^^caption^^^` syntax.
-   **Modern Dialogs**: Replaces native browser alerts/prompts with styled, accessible modals.

## Installation

### 1. Install Dependencies

Install the required Tiptap packages and utility libraries:

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
@tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder \
@tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header \
@tiptap/extension-task-list @tiptap/extension-task-item \
@tiptap/extension-highlight @tiptap/extension-code-block-lowlight \
turndown turndown-plugin-gfm marked lowlight react-icons
```

### 2. Add Component Files

Copy the `package` folder contents into your project (e.g., `components/editor`).

-   `TiptapEditor.tsx`: The main editor component logic.
-   `TiptapEditor.module.css`: Scoped styles for the editor interface.

### 3. Usage

Import the component and state management:

```tsx
"use client";

import { useState } from 'react';
import TiptapEditor from '@/components/editor/TiptapEditor';

export default function Page() {
    const [content, setContent] = useState('<p>Start writing...</p>');

    const handleImageUpload = async (file: File): Promise<string> => {
        // Implement upload logic (e.g., Supabase Storage, S3)
        // const url = await uploadService(file);
        // return url;
        return URL.createObjectURL(file); // Mock return for demo
    };

    return (
        <TiptapEditor
            content={content}
            onChange={setContent}
            onImageUpload={handleImageUpload}
        />
    );
}
```

## Customization

### Theming

The editor uses CSS variables to match your application's theme. Ensure these variables are defined in your global CSS (e.g., `globals.css`):

```css
:root {
  --background: #ffffff;
  --foreground: #09090b;
  --primary: #18181b;       /* Button active states */
  --muted: #f4f4f5;         /* Button hover backgrounds */
  --muted-foreground: #71717a; /* Icons and secondary text */
  --border: #e4e4e7;        /* Borders */
}

.dark {
  --background: #09090b;
  --foreground: #fafafa;
  /* ... define corresponding dark mode values */
}
```

### Styles

You can further customize the appearance by modifying `TiptapEditor.module.css`. The CSS classes are locally scoped to prevent conflicts with other parts of your application.

## License

MIT
