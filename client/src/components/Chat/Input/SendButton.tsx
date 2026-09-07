import React, { forwardRef } from 'react';
import { useWatch } from 'react-hook-form';
import { ArrowUp } from 'lucide-react';
import type { Control } from 'react-hook-form';
import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type SendButtonProps = {
  disabled: boolean;
  control: Control<{ text: string }>;
};

const SubmitButton = React.memo(
  forwardRef((props: { disabled: boolean }, ref: React.ForwardedRef<HTMLButtonElement>) => {
    const localize = useLocalize();
    return (
      <div className="chatone-touch-metal">
        <TooltipAnchor
          description={localize('com_nav_send_message')}
          render={
            <button
              ref={ref}
              aria-label={localize('com_nav_send_message')}
              id="send-button"
              disabled={props.disabled}
              className={cn(
                'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-text-primary outline-offset-4 transition-all duration-200 disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-10',
              )}
              data-testid="send-button"
              type="submit"
            >
              <span className="flex items-center justify-center" data-state="closed">
                <ArrowUp size={20} strokeWidth={2} aria-hidden="true" />
              </span>
            </button>
          }
        />
      </div>
    );
  }),
);

const SendButton = React.memo(
  forwardRef((props: SendButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) => {
    const data = useWatch({ control: props.control });
    const content = data?.text?.trim();
    return <SubmitButton ref={ref} disabled={props.disabled || !content} />;
  }),
);

export default SendButton;
