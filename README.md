# UniversalFileViewer

Componente React/TypeScript que detecta o tipo de arquivo odontológico (malha 3D, exame DICOM,
PDF ou imagem) e delega para o visualizador especializado correto.

## Estrutura

```
UniversalFileViewer/
├── UniversalFileViewer.tsx   # componente roteador: dropzone, loading, delega ao viewer certo
├── types.ts                  # tipos compartilhados + detecção de extensão
├── index.ts                  # export barrel
├── hooks/
│   └── useFileSource.ts      # normaliza File | string em URL resolvida + tipo detectado
└── viewers/
    ├── MeshViewer.tsx        # .stl / .obj / .ply via three.js + OrbitControls
    ├── DicomViewer.tsx       # .dcm / .dicom via cornerstone.js
    ├── DocumentViewer.tsx    # .pdf via pdfjs-dist
    └── ImageViewer.tsx       # .jpg / .jpeg / .png / .webp com zoom/pan nativo
```

## Instalação de dependências

```bash
npm install three
npm install cornerstone-core cornerstone-wado-image-loader dicom-parser
npm install pdfjs-dist
npm install --save-dev @types/three
```

> `cornerstone-wado-image-loader` usa web workers; em bundlers como Vite/Webpack pode ser
> necessário configurar `worker-loader` ou copiar os workers para `public/` — consulte a doc
> da lib para a versão do seu bundler.

> Em `DocumentViewer.tsx`, a importação do worker do PDF.js (`pdf.worker.min.mjs?url`) usa a
> sintaxe do Vite. Em CRA/Webpack, troque por `import 'pdfjs-dist/build/pdf.worker.entry'` ou
> aponte `GlobalWorkerOptions.workerSrc` para um CDN (ex: `https://unpkg.com/pdfjs-dist@.../pdf.worker.min.mjs`).

## Uso básico

```tsx
import { UniversalFileViewer } from './UniversalFileViewer';

function ExamAttachment() {
  return (
    <div style={{ width: 640, height: 480 }}>
      <UniversalFileViewer
        onFileSelected={(file) => console.log('Arquivo selecionado:', file.name)}
        onError={(err) => console.error(err)}
      />
    </div>
  );
}
```

### Com arquivo já hospedado (ex: vindo do prontuário)

```tsx
<UniversalFileViewer
  file="https://cdn.suaclinica.com/exames/paciente-123/panoramica.dcm"
  fileName="panoramica.dcm"
/>
```

## Notas de design

- **Roteamento por extensão**: `types.ts` centraliza o mapa extensão → tipo de viewer
  (`EXTENSION_TO_KIND`). Adicionar suporte a um novo formato é uma linha nesse mapa + um
  novo componente em `viewers/`.
- **Estado de loading unificado**: cada viewer reporta progresso via `onProgress`, então a
  barra de carregamento no componente pai funciona igual para os 4 tipos, mesmo que a origem
  do progresso seja diferente (bytes de rede no PDF/malha, decodificação no DICOM, `<img onLoad>`
  na imagem).
- **Limpeza de recursos**: `MeshViewer` descarta geometrias/materiais/renderer do three.js no
  unmount; `useFileSource` revoga `URL.createObjectURL` quando o arquivo muda; `DicomViewer`
  desabilita o elemento cornerstone no unmount. Isso evita vazamento de memória ao trocar de
  anexo repetidamente dentro do prontuário.
- **STL sem cor**: aplica material padrão "resina/gesso" (bege neutro) quando a geometria não
  traz `vertex colors`, já que STL raramente carrega cor.
  