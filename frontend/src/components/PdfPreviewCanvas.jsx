import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  FileText, 
  AlertCircle 
} from 'lucide-react';

// Configure pdfjs worker using CDN fallback matching pdfjs-dist version
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

const PdfPreviewCanvas = ({
  file,
  existingFileUrl,
  customizations = [],
  onUpdateCustomization,
  contacts = []
}) => {
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [pageImageUrl, setPageImageUrl] = useState(null);

  const [loading, setLoading] = useState(true);
  const [renderLoading, setRenderLoading] = useState(false);
  const [error, setError] = useState(null);

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [zoomScale, setZoomScale] = useState(1);
  const [fitMode, setFitMode] = useState('fitPage'); // 'fitPage' or 'fitWidth'

  // Dragging state for smooth variable movement
  const [draggingId, setDraggingId] = useState(null);
  const dragStartPos = useRef({ startX: 0, startY: 0, initItemX: 0, initItemY: 0 });

  // Determine if file is PDF
  const isPdf = Boolean(
    file 
      ? file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf')
      : existingFileUrl?.toLowerCase().includes('.pdf')
  );

  // Memoize stable preview URL so it doesn't regenerate on every render
  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (existingFileUrl?.startsWith('http')) return existingFileUrl;
    if (existingFileUrl) {
      return `${import.meta.env.VITE_CF_URL || 'https://assets.npjnxt.com'}/${existingFileUrl}`;
    }
    return null;
  }, [file, existingFileUrl]);

  // Cleanup object URL when file changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 1. Load Document (PDF or Image)
  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      if (!file && !existingFileUrl) {
        setLoading(false);
        setPdfDoc(null);
        setPageImageUrl(null);
        return;
      }

      setLoading(true);
      setError(null);
      setCurrentPage(1);
      setThumbnails([]);
      setPageImageUrl(null);

      if (!isPdf) {
        // Image document handling
        const img = new Image();
        img.src = previewUrl;
        img.onload = () => {
          if (!isCancelled) {
            setPdfDoc(null);
            setNumPages(1);
            setPageSize({ width: img.naturalWidth, height: img.naturalHeight });
            setPageImageUrl(previewUrl);
            setThumbnails([{ page: 1, url: previewUrl }]);
            setLoading(false);
          }
        };
        img.onerror = () => {
          if (!isCancelled) {
            setError('Failed to load image preview');
            setLoading(false);
          }
        };
        return;
      }

      // PDF document handling with pdfjs-dist
      try {
        let loadingTask;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          if (isCancelled) return;
          loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/cmaps/`,
            cMapPacked: true
          });
        } else {
          loadingTask = pdfjsLib.getDocument({ 
            url: previewUrl,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/cmaps/`,
            cMapPacked: true
          });
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF document:', err);
        if (!isCancelled) {
          setError('Failed to render PDF document. Please check the file.');
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [file, existingFileUrl, isPdf, previewUrl]);

  // 2. Render Main Page
  const renderCurrentPage = useCallback(async () => {
    if (!isPdf || !pdfDoc) return;

    setRenderLoading(true);

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancel error
      }
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);

      const unscaledViewport = page.getViewport({ scale: 1 });
      const origW = unscaledViewport.width;
      const origH = unscaledViewport.height;
      setPageSize({ width: origW, height: origH });

      // Calculate available space in container
      const container = containerRef.current;
      const availWidth = Math.max(300, (container?.clientWidth || 550) - 48);
      const availHeight = Math.max(350, (container?.clientHeight || 550) - 48);

      let scale = 1;
      if (fitMode === 'fitWidth') {
        scale = (availWidth / origW) * zoomScale;
      } else {
        // Fit Page mode: maximize within container
        const scaleW = availWidth / origW;
        const scaleH = availHeight / origH;
        scale = Math.min(scaleW, scaleH) * zoomScale;
      }

      const dispW = Math.round(origW * scale);
      const dispH = Math.round(origH * scale);
      setDisplaySize({ width: dispW, height: dispH });

      // Render at high resolution (2x Retina scale for crisp text)
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const renderScale = scale * dpr;
      const renderViewport = page.getViewport({ scale: renderScale });

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = Math.floor(renderViewport.width);
      offscreenCanvas.height = Math.floor(renderViewport.height);
      const context = offscreenCanvas.getContext('2d');

      const task = page.render({ canvasContext: context, viewport: renderViewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;

      const dataUrl = offscreenCanvas.toDataURL('image/png');
      setPageImageUrl(dataUrl);
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    } finally {
      setRenderLoading(false);
    }
  }, [isPdf, pdfDoc, currentPage, zoomScale, fitMode]);

  // Trigger page render when pdfDoc, page, zoom, or fitMode changes
  useEffect(() => {
    if (isPdf && pdfDoc) {
      renderCurrentPage();
    }
  }, [isPdf, pdfDoc, currentPage, zoomScale, fitMode, renderCurrentPage]);

  // 3. Generate Thumbnails (delayed slightly to give priority to main page render)
  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !isPdf) return;

    const genThumbs = async () => {
      const thumbs = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (isCancelled) return;
        try {
          const page = await pdfDoc.getPage(i);
          const unscaledViewport = page.getViewport({ scale: 1 });
          const thumbScale = 140 / unscaledViewport.width;
          const viewport = page.getViewport({ scale: thumbScale });

          const thumbCanvas = document.createElement('canvas');
          const context = thumbCanvas.getContext('2d');
          thumbCanvas.width = Math.floor(viewport.width);
          thumbCanvas.height = Math.floor(viewport.height);

          await page.render({ canvasContext: context, viewport }).promise;
          if (isCancelled) return;

          thumbs.push({ page: i, url: thumbCanvas.toDataURL('image/jpeg', 0.85) });
          setThumbnails([...thumbs]);
        } catch (e) {
          console.warn(`Thumbnail error on page ${i}:`, e);
        }
      }
    };

    const timer = setTimeout(() => {
      genThumbs();
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pdfDoc, isPdf]);

  // Image size handling
  useEffect(() => {
    if (!isPdf && pageSize.width > 0) {
      const container = containerRef.current;
      const availWidth = Math.max(300, (container?.clientWidth || 550) - 48);
      const availHeight = Math.max(350, (container?.clientHeight || 550) - 48);

      let scale = 1;
      if (fitMode === 'fitWidth') {
        scale = (availWidth / pageSize.width) * zoomScale;
      } else {
        const scaleW = availWidth / pageSize.width;
        const scaleH = availHeight / pageSize.height;
        scale = Math.min(scaleW, scaleH) * zoomScale;
      }

      setDisplaySize({
        width: Math.round(pageSize.width * scale),
        height: Math.round(pageSize.height * scale)
      });
    }
  }, [isPdf, pageSize, zoomScale, fitMode]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (isPdf && pdfDoc) {
        renderCurrentPage();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPdf, pdfDoc, renderCurrentPage]);

  // Drag & drop handlers
  const handlePointerDown = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(item.id);
    dragStartPos.current = {
      startX: e.clientX,
      startY: e.clientY,
      initItemX: item.x,
      initItemY: item.y
    };
  };

  const handlePointerMove = (e) => {
    if (!draggingId || !displaySize.width || !displaySize.height) return;

    const deltaX = e.clientX - dragStartPos.current.startX;
    const deltaY = e.clientY - dragStartPos.current.startY;

    const deltaPercentX = (deltaX / displaySize.width) * 100;
    const deltaPercentY = (deltaY / displaySize.height) * 100;

    let newX = dragStartPos.current.initItemX + deltaPercentX;
    let newY = dragStartPos.current.initItemY + deltaPercentY;

    newX = Math.max(2, Math.min(98, newX));
    newY = Math.max(2, Math.min(98, newY));

    const updated = customizations.map(c => 
      c.id === draggingId ? { ...c, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 } : c
    );
    if (onUpdateCustomization) onUpdateCustomization(updated);
  };

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  // HTML5 Drag and Drop fallback
  const handleContainerDrop = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('drag-id');
    if (!id || !displaySize.width || !displaySize.height) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    x = Math.max(2, Math.min(98, Math.round(x * 10) / 10));
    y = Math.max(2, Math.min(98, Math.round(y * 10) / 10));

    const updated = customizations.map(c => 
      c.id === id ? { ...c, x, y } : c
    );
    if (onUpdateCustomization) onUpdateCustomization(updated);
  };

  if (!file && !existingFileUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
        <FileText size={48} className="stroke-1 text-gray-300 mb-3" />
        <p className="font-semibold text-gray-600">No Document Uploaded</p>
        <p className="text-xs text-gray-400 mt-1">Upload a PDF or image in Step 3 to customize.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-1 pb-3 border-b border-gray-100 text-sm shrink-0 w-full gap-2">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <span className="font-semibold text-gray-700 truncate text-xs sm:text-sm" title={file ? file.name : (existingFileUrl?.split('/').pop() || 'Document Preview')}>
            {file ? file.name : (existingFileUrl?.split('/').pop() || 'Document Preview')}
          </span>
          {isPdf && numPages > 1 && (
            <span className="text-xs bg-purple-100 text-[#4c3963] px-2 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap">
              Page {currentPage}/{numPages}
            </span>
          )}
        </div>

        {/* Page Nav, Fit Mode & Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Page Navigation */}
          {isPdf && numPages > 1 && (
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded text-gray-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-semibold px-1.5 select-none text-gray-700">
                {currentPage}/{numPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="p-1 rounded text-gray-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Fit Page / Fit Width Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setFitMode('fitPage');
                setZoomScale(1);
              }}
              className={`px-2 py-1 text-xs font-medium rounded transition-all cursor-pointer flex items-center gap-1 ${
                fitMode === 'fitPage' && zoomScale === 1 ? 'bg-white text-[#4c3963] shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Fit Full Page in View"
            >
              <Minimize2 size={12} />
              Fit Page
            </button>
            <button
              type="button"
              onClick={() => {
                setFitMode('fitWidth');
                setZoomScale(1);
              }}
              className={`px-2 py-1 text-xs font-medium rounded transition-all cursor-pointer flex items-center gap-1 ${
                fitMode === 'fitWidth' && zoomScale === 1 ? 'bg-white text-[#4c3963] shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Fit Page Width"
            >
              <Maximize2 size={12} />
              Fit Width
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 border border-gray-200">
            <button
              type="button"
              onClick={() => setZoomScale(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
              disabled={zoomScale <= 0.5}
              className="p-1 rounded text-gray-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              className="text-xs font-semibold px-1 select-none text-gray-700 min-w-[38px] text-center hover:text-[#4c3963] cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(z => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
              disabled={zoomScale >= 2.0}
              className="p-1 rounded text-gray-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Preview Area + Thumbnails */}
      <div className="flex-1 flex gap-4 pt-3 overflow-hidden min-h-0 min-w-0 w-full">
        {/* Main Document Viewer Container */}
        <div 
          ref={containerRef}
          className="flex-1 min-w-0 bg-[#f0f2f5] border border-gray-200 rounded-lg relative overflow-auto shadow-inner select-none p-4 flex"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {loading && (
            <div className="m-auto flex flex-col items-center gap-2 text-gray-400 py-12">
              <Loader2 size={36} className="animate-spin text-[#4c3963]" />
              <span className="text-sm font-medium">Loading document...</span>
            </div>
          )}

          {error && !loading && (
            <div className="m-auto flex flex-col items-center gap-2 text-red-500 p-6 text-center max-w-sm">
              <AlertCircle size={36} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {!loading && !error && displaySize.width > 0 && (
            <div className="min-w-full min-h-full flex items-center justify-center p-2 w-max h-max m-auto">
              <div
                className="relative shadow-xl rounded-md border border-gray-300 bg-white transition-all overflow-hidden shrink-0"
                style={{
                  width: `${displaySize.width}px`,
                  height: `${displaySize.height}px`
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleContainerDrop}
              >
              {/* Rendered Document Page */}
              {pageImageUrl ? (
                <img
                  src={pageImageUrl}
                  alt={`Page ${currentPage}`}
                  style={{
                    width: `${displaySize.width}px`,
                    height: `${displaySize.height}px`
                  }}
                  className="w-full h-full object-contain pointer-events-none block"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white">
                  <Loader2 size={32} className="animate-spin text-[#4c3963]" />
                </div>
              )}

              {/* Render Loading Overlay */}
              {renderLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center">
                  <Loader2 size={28} className="animate-spin text-[#4c3963]" />
                </div>
              )}

              {/* Draggable Customization Tags Overlay */}
              {customizations.map(item => {
                let displayValue = item.variable;
                if (contacts && contacts.length > 0) {
                  const contact = contacts[0];
                  const vMap = {
                    'Name': contact.name,
                    'Number': contact.number,
                    'Var 1': contact.var1,
                    'Var 2': contact.var2,
                    'Var 3': contact.var3,
                    'Var 4': contact.var4,
                    'Var 5': contact.var5
                  };
                  if (vMap[item.variable]) displayValue = vMap[item.variable];
                }

                const isCurrentlyDragging = draggingId === item.id;
                const dynamicFontSize = Math.max(12, Math.round((item.fontSize || 20) * (displaySize.width / (pageSize.width || 600))));

                return (
                  <div
                    key={item.id}
                    onPointerDown={(e) => handlePointerDown(e, item)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('drag-id', item.id);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${dynamicFontSize}px`,
                      color: item.color || '#323232',
                      fontFamily: item.font || 'sans-serif'
                    }}
                    className={`absolute cursor-move select-none whitespace-nowrap z-20 font-bold px-2.5 py-1 rounded-md border ${
                      isCurrentlyDragging 
                        ? 'border-dashed border-[#4c3963] bg-purple-100/90 shadow-xl ring-2 ring-purple-400 scale-105' 
                        : 'border-dashed border-purple-400 bg-white/95 shadow-sm hover:border-solid hover:border-[#4c3963] hover:bg-white hover:shadow-md'
                    } transition-all`}
                    title={`Drag to position ${item.variable} (x: ${item.x}%, y: ${item.y}%)`}
                  >
                    {displayValue}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Thumbnails Sidebar */}
        <div className="w-28 shrink-0 flex flex-col gap-2.5 overflow-y-auto pr-1 custom-scrollbar pb-2">
          {isPdf ? (
            Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => {
              const thumb = thumbnails.find(t => t.page === pageNum);
              const isActive = currentPage === pageNum;

              return (
                <div
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-full group cursor-pointer rounded-lg border-2 p-1 transition-all flex flex-col items-center bg-white shadow-xs ${
                    isActive 
                      ? 'border-[#4c3963] ring-2 ring-purple-100 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-xs'
                  }`}
                >
                  <div className="w-full h-28 bg-[#f8f9fa] rounded overflow-hidden flex items-center justify-center p-1">
                    {thumb ? (
                      <img 
                        src={thumb.url} 
                        alt={`Page ${pageNum}`} 
                        className="w-full h-full object-contain pointer-events-none rounded shadow-2xs" 
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <FileText size={20} />
                        <span className="text-[10px]">Page {pageNum}</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold mt-1 transition-colors ${
                    isActive ? 'text-[#4c3963]' : 'text-gray-500 group-hover:text-gray-700'
                  }`}>
                    Page {pageNum}
                  </span>
                </div>
              );
            })
          ) : (
            <div
              className="w-full cursor-pointer rounded-lg border-2 border-[#4c3963] ring-2 ring-purple-100 p-1 bg-white shadow-xs flex flex-col items-center"
            >
              <div className="w-full h-28 bg-[#f8f9fa] rounded overflow-hidden flex items-center justify-center p-1">
                <img 
                  src={previewUrl} 
                  alt="Thumbnail" 
                  className="w-full h-full object-contain pointer-events-none rounded shadow-2xs" 
                />
              </div>
              <span className="text-[11px] font-semibold mt-1 text-[#4c3963]">
                Image
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfPreviewCanvas;
