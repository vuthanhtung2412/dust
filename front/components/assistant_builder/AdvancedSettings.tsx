import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Label,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  ScrollArea,
  ScrollBar,
} from "@dust-tt/sparkle";
import dynamic from "next/dynamic";
import React from "react";

import type { AssistantBuilderState } from "@app/components/assistant_builder/types";
import { getModelProviderLogo } from "@app/components/providers/types";
import { useTheme } from "@app/components/sparkle/ThemeContext";
import { getSupportedModelConfig } from "@app/lib/assistant";
import type {
  AssistantCreativityLevel,
  ModelConfigurationType,
  ModelIdType,
  SupportedModel,
} from "@app/types";
import {
  ASSISTANT_CREATIVITY_LEVEL_DISPLAY_NAMES,
  ASSISTANT_CREATIVITY_LEVEL_TEMPERATURES,
  CLAUDE_3_5_SONNET_20241022_MODEL_ID,
  GPT_4O_MODEL_ID,
  isSupportingResponseFormat,
  MISTRAL_LARGE_MODEL_ID,
} from "@app/types";

const CodeEditor = dynamic(
  () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
  { ssr: false }
);

const BEST_PERFORMING_MODELS_ID: ModelIdType[] = [
  GPT_4O_MODEL_ID,
  CLAUDE_3_5_SONNET_20241022_MODEL_ID,
  MISTRAL_LARGE_MODEL_ID,
] as const;

export const CREATIVITY_LEVELS = Object.entries(
  ASSISTANT_CREATIVITY_LEVEL_TEMPERATURES
).map(([k, v]) => ({
  label:
    ASSISTANT_CREATIVITY_LEVEL_DISPLAY_NAMES[k as AssistantCreativityLevel],
  value: v,
}));

function isBestPerformingModel(modelId: ModelIdType) {
  return BEST_PERFORMING_MODELS_ID.includes(modelId);
}

const getCreativityLevelFromTemperature = (temperature: number) => {
  const closest = CREATIVITY_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - temperature) < Math.abs(prev.value - temperature)
      ? curr
      : prev
  );
  return closest;
};

const isInvalidJson = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }
  try {
    const parsed = JSON.parse(value);
    return !parsed || typeof parsed !== "object";
  } catch {
    return true;
  }
};

export function AdvancedSettings({
  generationSettings,
  setGenerationSettings,
  models,
}: {
  generationSettings: AssistantBuilderState["generationSettings"];
  setGenerationSettings: (
    generationSettingsSettings: AssistantBuilderState["generationSettings"]
  ) => void;
  models: ModelConfigurationType[];
}) {
  const { isDark } = useTheme();
  if (!models) {
    return null;
  }

  const supportedModelConfig = getSupportedModelConfig(
    generationSettings.modelSettings
  );
  if (!supportedModelConfig) {
    // unreachable
    alert("Unsupported model");
  }

  const supportsResponseFormat = isSupportingResponseFormat(
    generationSettings.modelSettings.modelId
  );
  const bestPerformingModelConfigs: ModelConfigurationType[] = [];
  const otherModelConfigs: ModelConfigurationType[] = [];
  for (const modelConfig of models) {
    if (isBestPerformingModel(modelConfig.modelId)) {
      bestPerformingModelConfigs.push(modelConfig);
    } else {
      otherModelConfigs.push(modelConfig);
    }
  }

  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <Button
          label="Advanced settings"
          variant="outline"
          size="sm"
          isSelect
        />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" align="end">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2">
            <Label>Model selection</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  isSelect
                  label={
                    getSupportedModelConfig(generationSettings.modelSettings)
                      .displayName
                  }
                  variant="outline"
                  size="sm"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel label="Best performing models" />
                <ScrollArea className="flex max-h-72 flex-col" hideScrollBar>
                  <ModelList
                    modelConfigs={bestPerformingModelConfigs}
                    onClick={(modelSettings) => {
                      setGenerationSettings({
                        ...generationSettings,
                        modelSettings,
                      });
                    }}
                  />
                  <DropdownMenuLabel label="Other models" />
                  <ModelList
                    modelConfigs={otherModelConfigs}
                    onClick={(modelSettings) => {
                      setGenerationSettings({
                        ...generationSettings,
                        modelSettings,
                      });
                    }}
                  />
                  <ScrollBar className="py-0" />
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label>Creativity level</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  isSelect
                  label={
                    getCreativityLevelFromTemperature(
                      generationSettings?.temperature
                    ).label
                  }
                  variant="outline"
                  size="sm"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {CREATIVITY_LEVELS.map(({ label, value }) => (
                  <DropdownMenuItem
                    key={label}
                    label={label}
                    onClick={() => {
                      setGenerationSettings({
                        ...generationSettings,
                        temperature: value,
                      });
                    }}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {supportsResponseFormat && (
            <div className="flex flex-col gap-2">
              <Label>Structured Response Format</Label>
              <ScrollArea className="h-96">
                <CodeEditor
                  data-color-mode={isDark ? "dark" : "light"}
                  value={generationSettings?.responseFormat ?? ""}
                  placeholder={
                    "Example:\n\n" +
                    "{\n" +
                    '  "type": "json_schema",\n' +
                    '  "json_schema": {\n' +
                    '    "name": "YourSchemaName",\n' +
                    '    "strict": true,\n' +
                    '    "schema": {\n' +
                    '      "type": "object",\n' +
                    '      "properties": {\n' +
                    '        "property1":\n' +
                    '          { "type":"string" }\n' +
                    "      },\n" +
                    '      "required": ["property1"],\n' +
                    '      "additionalProperties": false\n' +
                    "    }\n" +
                    "  }\n" +
                    "}"
                  }
                  name="responseFormat"
                  onChange={(e) => {
                    setGenerationSettings({
                      ...generationSettings,
                      responseFormat: e.target.value,
                    });
                  }}
                  minHeight={380}
                  className={cn(
                    "rounded-lg",
                    isInvalidJson(generationSettings?.responseFormat)
                      ? "border-2 border-red-500 bg-slate-100 dark:bg-slate-100-night"
                      : "bg-slate-100 dark:bg-slate-100-night"
                  )}
                  style={{
                    fontSize: 13,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace",
                  }}
                  language="json"
                />
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

interface ModelListProps {
  modelConfigs: ModelConfigurationType[];
  onClick: (modelSettings: SupportedModel) => void;
}

function ModelList({ modelConfigs, onClick }: ModelListProps) {
  const { isDark } = useTheme();
  const handleClick = (modelConfig: ModelConfigurationType) => {
    onClick({
      modelId: modelConfig.modelId,
      providerId: modelConfig.providerId,
      reasoningEffort: modelConfig.reasoningEffort,
    });
  };

  return (
    <>
      {modelConfigs.map((modelConfig) => (
        <DropdownMenuItem
          key={`${modelConfig.modelId}${modelConfig.reasoningEffort ? `-${modelConfig.reasoningEffort}` : ""}`}
          icon={getModelProviderLogo(modelConfig.providerId, isDark)}
          description={modelConfig.shortDescription}
          label={modelConfig.displayName}
          onClick={() => handleClick(modelConfig)}
        />
      ))}
    </>
  );
}
