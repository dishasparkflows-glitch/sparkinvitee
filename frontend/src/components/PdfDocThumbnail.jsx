import { useState, useEffect, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText, Loader2 } from 'lucide-react';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

const PdfDocThumbnail = ({ file, url, className = 'w-full h-full object-contain' }) => {
  const [thumbUrl, setThumbUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const isPdf = Boolean(
    file 
      ? file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf')
      : url?.toLowerCase().includes('.pdf')
  );

  const resolvedUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (url?.startsWith('http')) return url;
    if (url) return `${import.meta.env.VITE_CF_URL || 'https://assets.npjnxt.com'}/${url}`;
    return null;
  }, [file, url]);

  useEffect(() => {
    return () => {
      if (resolvedUrl && resolvedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedUrl);
      }
    };
  }, [resolvedUrl]);

  useEffect(() => {
    let isCancelled = false;

    if (!file && !url) {
      setLoading(false);
      return;
    }

    if (!isPdf) {
      setThumbUrl(resolvedUrl);
      setLoading(false);
      return;
    }

    const loadThumbnail = async () => {
      setLoading(true);
      try {
        let loadingTask;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        } else {
          loadingTask = pdfjsLib.getDocument({
            url: resolvedUrl,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/cmaps/`,
            cMapPacked: true
          });
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        if (isCancelled) return;

        setThumbUrl(canvas.toDataURL());
        setLoading(false);
      } catch (err) {
        console.warn('Could not generate PDF thumbnail:', err);
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      isCancelled = true;
    };
  }, [file, url, isPdf, resolvedUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
        <Loader2 size={24} className="animate-spin text-[#4c3963]" />
      </div>
    );
  }

  if (thumbUrl) {
    return <img src={thumbUrl} alt="Thumbnail" className={className} />;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500 p-2 text-center">
      <FileText size={32} className="text-[#4c3963] mb-1" />
      <span className="text-[11px] font-medium">PDF Document</span>
    </div>
  );
};

export default PdfDocThumbnail;
