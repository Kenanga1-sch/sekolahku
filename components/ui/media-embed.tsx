import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, Loader2 } from 'lucide-react';

interface MediaEmbedProps {
  url: string;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'portrait' | 'auto';
  fill?: boolean; // If true, behaves like Next/Image fill
}

export function MediaEmbed({ 
  url, 
  alt, 
  className = "", 
  aspectRatio = 'auto',
  fill = false
}: MediaEmbedProps) {
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | 'instagram'>('image');
  const [embedUrl, setEmbedUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    
    // Check YouTube
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed/')) {
      setMediaType('youtube');
      setIsLoading(true);
      
      // Extract video ID
      let videoId = '';
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('youtube.com/watch')) {
        const urlParams = new URL(url).searchParams;
        videoId = urlParams.get('v') || '';
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('youtube.com/embed/')[1]?.split('?')[0];
      }
      
      if (videoId) {
        setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`);
      }
    } 
    // Check Instagram
    else if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/')) {
      setMediaType('instagram');
      setIsLoading(true);
      
      // Extract post ID to format clean embed url
      // e.g. https://www.instagram.com/p/ABCDEFG/
      let cleanUrl = url.split('?')[0];
      if (!cleanUrl.endsWith('/')) cleanUrl += '/';
      setEmbedUrl(`${cleanUrl}embed`);
    } 
    // Default Image
    else {
      setMediaType('image');
    }
  }, [url]);

  const wrapperClass = `relative overflow-hidden ${
    aspectRatio === 'video' ? 'aspect-video' :
    aspectRatio === 'square' ? 'aspect-square' :
    aspectRatio === 'portrait' ? 'aspect-[4/5]' : ''
  } ${fill ? 'w-full h-full' : ''} ${className}`;

  if (!url) {
    return <div className={`bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center ${wrapperClass}`} />;
  }

  if (mediaType === 'image') {
    return (
      <div className={wrapperClass}>
        {url.startsWith('/') || url.startsWith('http') ? (
          // Use standard img if we want to avoid Next.js Image loader domain issues for random URLs
          // But since it's mostly local or known, we can try next/image or fallback to img
          <img 
            src={url} 
            alt={alt} 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
    );
  }

  if (mediaType === 'youtube') {
    return (
      <div className={`bg-black group ${wrapperClass}`}>
        {!isPlaying ? (
          <div 
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={() => setIsPlaying(true)}
          >
            {/* YouTube thumbnail placeholder */}
            <img 
              src={`https://img.youtube.com/vi/${embedUrl.split('/embed/')[1]?.split('?')[0]}/maxresdefault.jpg`}
              alt={alt}
              className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity"
              onError={(e) => {
                // Fallback to hqdefault if maxresdefault is not available
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${embedUrl.split('/embed/')[1]?.split('?')[0]}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
          </div>
        ) : (
          <iframe 
            src={embedUrl} 
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
          />
        )}
      </div>
    );
  }

  if (mediaType === 'instagram') {
    return (
      <div className={`bg-white dark:bg-zinc-950 ${wrapperClass}`}>
        {!isPlaying ? (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-zinc-100 dark:bg-zinc-900"
            onClick={() => setIsPlaying(true)}
          >
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px] mb-3">
               <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-[14px] flex items-center justify-center">
                 <Play className="w-5 h-5 text-zinc-800 dark:text-zinc-200 fill-current" />
               </div>
             </div>
             <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Muat Postingan Instagram</span>
          </div>
        ) : (
          <iframe 
            src={embedUrl}
            className="absolute top-0 left-0 w-full h-full border-0"
            scrolling="no"
            allowTransparency={true}
          />
        )}
      </div>
    );
  }

  return null;
}
