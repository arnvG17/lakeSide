"use client";

import React, { useRef, useEffect, useState } from "react";
import { Eraser, Pencil, Trash2, Square, Circle as CircleIcon, Download, Undo2 } from "lucide-react";
import { motion } from "framer-motion";

interface Point {
    x: number;
    y: number;
}

export const AnnotationBoard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#ea580c");
    const [brushSize, setBrushSize] = useState(4);
    const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
    const [history, setHistory] = useState<ImageData[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resizeCanvas = () => {
            const container = containerRef.current;
            if (!container) return;

            // Save current content
            const tempImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;

            // Restore content
            ctx.putImageData(tempImageData, 0, 0);

            // Re-set line properties
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Save history state before starting new stroke
        setHistory(prev => [...prev.slice(-10), ctx.getImageData(0, 0, canvas.width, canvas.height)]);

        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { x, y } = getCoordinates(e);

        ctx.lineWidth = brushSize;
        ctx.strokeStyle = tool === "eraser" ? "#000000" : color;
        ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const undo = () => {
        if (history.length === 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const lastState = history[history.length - 1];
        ctx.putImageData(lastState, 0, 0);
        setHistory(prev => prev.slice(0, -1));
    };

    return (
        <div ref={containerRef} className="relative w-full h-full min-h-[400px] bg-black/40 rounded-3xl border border-white/5 overflow-hidden group">
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair touch-none"
            />

            {/* Floating Tool Palette - Startup Style */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute left-1/2 -translate-x-1/2 bottom-8 flex items-center gap-3 p-3 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            >
                <div className="flex gap-1.5 p-1 bg-white/5 rounded-full border border-white/5">
                    <button
                        onClick={() => setTool("pencil")}
                        className={`p-3 rounded-full transition-all duration-300 ${tool === "pencil" ? "bg-white text-black shadow-xl scale-110" : "text-white/40 hover:text-white"}`}
                    >
                        <Pencil size={18} />
                    </button>
                    <button
                        onClick={() => setTool("eraser")}
                        className={`p-3 rounded-full transition-all duration-300 ${tool === "eraser" ? "bg-white text-black shadow-xl scale-110" : "text-white/40 hover:text-white"}`}
                    >
                        <Eraser size={18} />
                    </button>
                </div>

                <div className="w-px h-8 bg-white/10 mx-1" />

                <div className="flex gap-2.5 px-3">
                    {["#ea580c", "#ffffff", "#ef4444", "#3b82f6"].map(c => (
                        <button
                            key={c}
                            onClick={() => { setColor(c); setTool("pencil"); }}
                            className={`w-7 h-7 rounded-full border-2 transition-all duration-300 hover:scale-125 ${color === c && tool === "pencil" ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>

                <div className="w-px h-8 bg-white/10 mx-1" />

                <div className="flex gap-1.5">
                    <button
                        onClick={undo}
                        disabled={history.length === 0}
                        className="p-3 rounded-full text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-10 transition-all duration-300"
                    >
                        <Undo2 size={18} />
                    </button>

                    <button
                        onClick={clearCanvas}
                        className="p-3 rounded-full text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all duration-300"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </motion.div>

            {/* Size Indicator - Minimal vertical slider */}
            <div className="absolute top-10 right-10 flex flex-col items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-32 accent-white cursor-pointer h-1 rounded-full appearance-none bg-white/10"
                />
                <span className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold">Brush {brushSize}px</span>
            </div>

            <div className="absolute top-10 left-10 pointer-events-none">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ea580c] shadow-[0_0_8px_#ea580c]" />
                    <span className="text-[9px] uppercase tracking-[0.4em] font-medium text-white/40">Studio Canvas</span>
                </div>
            </div>
        </div>
    );
};
