/**
 * Shared documentation components.
 * Used across all /docs/* pages for consistent formatting.
 */

import React from 'react';

/* -------------------------------------------------------------------------- */
/*  CodeBlock                                                                  */
/* -------------------------------------------------------------------------- */

export function CodeBlock({
  children,
  title,
}: {
  children: string;
  title?: string;
}) {
  return (
    <div className="not-prose my-5">
      {title && (
        <div className="rounded-t-lg bg-slate-700 px-4 py-2 text-xs font-medium text-slate-300">
          {title}
        </div>
      )}
      <pre
        className={`overflow-x-auto bg-slate-800 p-4 ${title ? 'rounded-b-lg' : 'rounded-lg'}`}
      >
        <code className="text-[13px] leading-relaxed text-slate-50 font-mono">
          {children}
        </code>
      </pre>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FlagTable  — for CLI option/flag reference                                */
/* -------------------------------------------------------------------------- */

export function FlagTable({
  flags,
}: {
  flags: { flag: string; description: string; default?: string }[];
}) {
  const hasDefaults = flags.some((f) => f.default);
  return (
    <div className="not-prose my-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-left">
            <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
              Flag
            </th>
            <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
              Description
            </th>
            {hasDefaults && (
              <th className="py-2 font-semibold text-slate-700 dark:text-slate-300">
                Default
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr
              key={f.flag}
              className="border-b border-slate-100 dark:border-slate-800"
            >
              <td className="py-2 pr-4 font-mono text-xs text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                {f.flag}
              </td>
              <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                {f.description}
              </td>
              {hasDefaults && (
                <td className="py-2 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {f.default ?? '\u2014'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ParamTable  — for MCP tool parameters                                     */
/* -------------------------------------------------------------------------- */

export function ParamTable({
  params,
}: {
  params: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}) {
  return (
    <div className="not-prose my-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-left">
            <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
              Parameter
            </th>
            <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
              Type
            </th>
            <th className="py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
              Required
            </th>
            <th className="py-2 font-semibold text-slate-700 dark:text-slate-300">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr
              key={p.name}
              className="border-b border-slate-100 dark:border-slate-800"
            >
              <td className="py-2 pr-4 font-mono text-xs text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                {p.name}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                {p.type}
              </td>
              <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                {p.required ? 'Yes' : 'No'}
              </td>
              <td className="py-2 text-slate-600 dark:text-slate-300">
                {p.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Callout  — tip / warning / note boxes                                     */
/* -------------------------------------------------------------------------- */

const calloutStyles = {
  tip: {
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    icon: '\u2139\uFE0F',
    label: 'Tip',
    labelColor: 'text-cyan-700 dark:text-cyan-400',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: '\u26A0\uFE0F',
    label: 'Warning',
    labelColor: 'text-amber-700 dark:text-amber-400',
  },
  note: {
    border: 'border-slate-400/40',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    icon: '\uD83D\uDCDD',
    label: 'Note',
    labelColor: 'text-slate-700 dark:text-slate-300',
  },
};

export function Callout({
  type,
  children,
}: {
  type: 'tip' | 'warning' | 'note';
  children: React.ReactNode;
}) {
  const s = calloutStyles[type];
  return (
    <div
      className={`my-5 rounded-lg border-l-4 ${s.border} ${s.bg} px-4 py-3`}
    >
      <p className={`text-sm font-semibold ${s.labelColor} mb-1`}>
        {s.label}
      </p>
      <div className="text-sm text-slate-600 dark:text-slate-300 [&>p]:mb-0">
        {children}
      </div>
    </div>
  );
}
