import { useEffect, useRef } from "react";

import ArrowUpIcon from "@/components/icons/ArrowUpIcon";
import { Button } from "@/components/ui/Button";

interface ComposerProps {
  readonly prompt: string;
  readonly setPrompt: (prompt: string) => void;
  readonly onSubmit: () => void;
  readonly isLoading: boolean;
  readonly audioChat?: React.ReactNode;
}

export function Composer({
  prompt,
  setPrompt,
  onSubmit,
  isLoading,
  audioChat,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  return (
    <div className="flex flex-row relative px-5 py-6 w-full max-w-2xl" suppressHydrationWarning>
      <div
        className="flex flex-row gap-2 w-full relative border-2 border-gray-100 rounded-[32px] focus:outline-none pl-6 pr-1"
        suppressHydrationWarning
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          rows={1}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask a question"
          className="py-3 flex-grow resize-none overflow-hidden focus:outline-none"
          suppressHydrationWarning
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (prompt.trim() === "") {
                return;
              }
              onSubmit();
            }
          }}
        />
        <div className="flex flex-shrink-0 min-w-20 flex-row gap-2 items-center mt-1">
          {audioChat}
          <Button
            size="iconSmall"
            className="mb-1 me-1"
            variant="primary"
            onClick={onSubmit}
            disabled={isLoading || prompt.trim() === ""}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
