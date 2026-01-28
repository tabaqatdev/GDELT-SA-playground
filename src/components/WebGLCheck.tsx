import { useEffect, useState } from 'react';

export function WebGLCheck() {
  const [webglStatus, setWebglStatus] = useState<{
    supported: boolean;
    version: string | null;
    error: string | null;
  }>({ supported: false, version: null, error: null });

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) {
        setWebglStatus({
          supported: false,
          version: null,
          error: 'WebGL is not available in your browser'
        });
        return;
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : 'Unknown';

      setWebglStatus({
        supported: true,
        version: gl instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1',
        error: null
      });

      console.log('✅ WebGL Check:', {
        version: gl instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1',
        renderer,
        vendor: gl.getParameter(gl.VENDOR),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      });
    } catch (error) {
      setWebglStatus({
        supported: false,
        version: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, []);

  if (!webglStatus.supported) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
        ⚠️ WebGL Error: {webglStatus.error}
      </div>
    );
  }

  return null;
}
