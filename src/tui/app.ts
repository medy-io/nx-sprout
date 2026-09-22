import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type Renderable,
  type SelectOption,
} from "@opentui/core";
import {
  generatorFieldChoices,
  generatorFields,
  isMultiselectField,
} from "../domain/generator.ts";
import { searchGenerators } from "../domain/generator-search.ts";
import type { GeneratorChoice } from "../domain/interfaces/generator-choice.interface.ts";
import type { GeneratorDescriptor } from "../domain/interfaces/generator-descriptor.interface.ts";
import type { GeneratorValidator } from "../domain/interfaces/generator-validator.interface.ts";
import type { GeneratorField } from "../domain/interfaces/generator-field.interface.ts";
import {
  coerceInputValue,
  createGeneratorValidator,
  formatInputValue,
  initialGeneratorValues,
} from "../domain/options.ts";
import type { GeneratorValue } from "../domain/types/generator-value.type.ts";
import type { GeneratorValues } from "../domain/types/generator-values.type.ts";
import { displayCommand, generatorArguments } from "../nx/command.ts";
import type { NxSproutOptions } from "./interfaces/nx-sprout-options.interface.ts";
import { COLORS } from "./constants/colors.constants.ts";
import type { AppScreen } from "./types/app-screen.type.ts";

export class NxSproutApplication {
  private screen: AppScreen = "generators";
  private screenRoot: BoxRenderable | undefined;
  private focusables: Renderable[] = [];
  private optionsScroll: ScrollBoxRenderable | undefined;
  private focusIndex = 0;
  private selectedGenerator: GeneratorDescriptor | undefined;
  private selectedValidator: GeneratorValidator | undefined;
  private values: GeneratorValues = {};
  private showInternalOptions: boolean;
  private previewText: TextRenderable | undefined;
  private helpText: TextRenderable | undefined;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private previewVersion = 0;
  private mutationInProgress = false;
  private readonly dryRunOnChange: boolean;
  private readonly dryRunDelayMs: number;
  private readonly keypressHandler: (key: KeyEvent) => void;
  private readonly colors = COLORS;
  private destroyed = false;

  constructor(
    private readonly renderer: CliRenderer,
    private readonly options: NxSproutOptions,
  ) {
    this.dryRunOnChange = options.dryRunOnChange ?? true;
    this.dryRunDelayMs = options.dryRunDelayMs ?? 350;
    this.showInternalOptions = options.showInternalOptions ?? false;
    this.keypressHandler = (key) => this.onGlobalKey(key);
  }

  mount(): void {
    this.renderer.setTerminalTitle("Nx Sprout");
    this.renderer.keyInput.on("keypress", this.keypressHandler);
    this.showGeneratorPicker();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.invalidatePendingRun();
    this.renderer.keyInput.off("keypress", this.keypressHandler);
    this.options.onExit?.();
    if (!this.renderer.isDestroyed) this.renderer.destroy();
  }

  private showGeneratorPicker(): void {
    this.invalidatePendingRun();
    this.previewText = undefined;
    this.screen = "generators";
    this.optionsScroll = undefined;
    this.replaceScreen("Choose an Nx generator", "Type to filter • Enter select • Esc/Ctrl+C quit");
    const root = this.requireScreenRoot();

    const searchBox = panel(this.renderer, {
      id: "generator-search-box",
      title: " Search ",
      height: 3,
      flexShrink: 0,
    });
    const search = new InputRenderable(this.renderer, {
      id: "generator-search",
      width: "100%",
      value: "",
      placeholder: "component, service, library…",
      textColor: this.colors.text,
      cursorColor: this.colors.accent,
      backgroundColor: this.colors.panel,
      focusedBackgroundColor: this.colors.panel,
    });
    searchBox.add(search);

    const listBox = panel(this.renderer, {
      id: "generator-list-box",
      title: this.generatorListTitle(this.options.generators.length),
      flexGrow: 1,
      marginTop: 1,
    });
    const list = new SelectRenderable(this.renderer, {
      id: "generator-list",
      width: "100%",
      height: "100%",
      options: this.generatorOptions(this.options.generators),
      showDescription: true,
      showScrollIndicator: true,
      wrapSelection: true,
      textColor: this.colors.text,
      focusedTextColor: this.colors.text,
      descriptionColor: this.colors.muted,
      selectedDescriptionColor: this.colors.text,
      selectedBackgroundColor: this.colors.selection,
      selectedTextColor: this.colors.accent,
      backgroundColor: this.colors.panel,
      focusedBackgroundColor: this.colors.panel,
    });
    listBox.add(list);
    root.add(searchBox);
    if ((this.options.warnings?.length ?? 0) > 0) {
      root.add(
        new TextRenderable(this.renderer, {
          id: "discovery-warnings",
          width: "100%",
          height: 2,
          content: `Warnings: ${this.options.warnings?.join(" | ")}`,
          fg: this.colors.warning,
          wrapMode: "word",
        }),
      );
    }
    root.add(listBox);

    const updateFilter = (query: string): void => {
      const filtered = searchGenerators(this.options.generators, query);
      list.options = this.generatorOptions(filtered);
      listBox.title = this.generatorListTitle(filtered.length);
    };

    search.on(InputRenderableEvents.INPUT, updateFilter);
    search.on(InputRenderableEvents.ENTER, () => list.focus());
    list.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_index: number, option: SelectOption | null) => {
        const generator = option?.value as GeneratorDescriptor | undefined;
        if (generator) this.showOptions(generator);
      },
    );

    this.focusables = [search, list];
    this.focusIndex = 0;
    search.focus();
  }

  private showOptions(generator: GeneratorDescriptor, resetValues = true): void {
    this.screen = "options";
    this.selectedGenerator = generator;
    if (resetValues) {
      this.values = initialGeneratorValues(generator);
      this.selectedValidator = createGeneratorValidator(generator);
    }
    this.selectedValidator ??= createGeneratorValidator(generator);
    this.replaceScreen(
      generator.id,
      "Tab move • Ctrl+R preview • F2 advanced • Ctrl+G execute • Esc back",
    );
    const root = this.requireScreenRoot();
    root.flexDirection = "row";

    const optionsPanel = panel(this.renderer, {
      id: "options-panel",
      title: " Generator options ",
      width: "48%",
      flexShrink: 0,
      marginRight: 1,
    });
    optionsPanel.flexDirection = "column";
    const optionsScroll = new ScrollBoxRenderable(this.renderer, {
      id: "options-scroll",
      width: "100%",
      height: "100%",
      scrollY: true,
      scrollX: false,
      viewportCulling: true,
    });
    this.optionsScroll = optionsScroll;

    const previewPanel = panel(this.renderer, {
      id: "preview-panel",
      title: " Live dry-run ",
      flexGrow: 1,
    });
    this.previewText = new TextRenderable(this.renderer, {
      id: "preview-text",
      width: "100%",
      height: "100%",
      content: "Waiting for valid options…",
      fg: this.colors.muted,
      wrapMode: "word",
      selectable: true,
    });
    previewPanel.add(this.previewText);

    this.focusables = [];
    const fields = generatorFields(generator.schema).filter(
      (field) => this.showInternalOptions || field.priority !== "internal",
    );
    for (const field of fields) optionsScroll.add(this.createField(field));
    optionsPanel.add(optionsScroll);

    root.add(optionsPanel);
    root.add(previewPanel);
    this.focusIndex = 0;
    this.focusables[0]?.focus();
    this.updateCommandPreview();
    this.scheduleDryRun();
  }

  private createField(field: GeneratorField): BoxRenderable {
    const prompt = field.property["x-prompt"];
    const propertyTypes = Array.isArray(field.property.type)
      ? field.property.type
      : [field.property.type];
    const isBoolean =
      propertyTypes.includes("boolean") ||
      (typeof prompt === "object" && prompt.type === "confirmation");
    const isMultiselect = isMultiselectField(field);
    const fieldChoices = generatorFieldChoices(field, this.options.projects);
    const usesSelect = !isMultiselect && (isBoolean || fieldChoices.length > 0);
    const deprecated = field.property["x-deprecated"];
    const detail = [
      field.description,
      field.property["x-hint"],
      deprecated ? `Deprecated${typeof deprecated === "string" ? `: ${deprecated}` : ""}` : "",
      isMultiselect && fieldChoices.length > 0 ? "Space or Enter toggles choices" : "",
    ]
      .filter(Boolean)
      .join(" • ");
    const labelHeight = detail ? 2 : 1;

    const container = new BoxRenderable(this.renderer, {
      id: `field-${field.name}`,
      width: "100%",
      height: labelHeight + 3,
      flexDirection: "column",
      flexShrink: 0,
      marginBottom: 1,
    });
    container.add(
      new TextRenderable(this.renderer, {
        id: `label-${field.name}`,
        width: "100%",
        height: labelHeight,
        content: `${field.name}${field.required ? " *" : ""}${detail ? `\n${detail}` : ""}`,
        fg: deprecated ? this.colors.warning : field.required ? this.colors.accent : this.colors.text,
        wrapMode: "word",
      }),
    );

    if (isMultiselect && fieldChoices.length > 0) {
      return this.createMultiselectField(container, field, fieldChoices);
    }

    if (usesSelect) {
      const declaredChoices =
        fieldChoices.length > 0
          ? fieldChoices
          : [
              { label: "true", description: "", value: true },
              { label: "false", description: "", value: false },
            ];
      const currentValue = this.values[field.name];
      const selectOptions: SelectOption[] = [
        ...(currentValue === undefined
          ? [{ name: "(unset)", description: "Do not pass this option", value: undefined }]
          : []),
        ...declaredChoices.map((choice) => ({
          name: choice.label,
          description: choice.description,
          value: choice.value,
        })),
      ];
      const selectedIndex = Math.max(
        0,
        selectOptions.findIndex((option) => valuesEqual(option.value, currentValue)),
      );
      const select = new SelectRenderable(this.renderer, {
        id: `option-${field.name}`,
        width: "100%",
        height: 3,
        options: selectOptions,
        selectedIndex,
        showDescription: selectOptions.some((option) => option.description.length > 0),
        wrapSelection: true,
        selectedBackgroundColor: this.colors.selection,
        selectedTextColor: this.colors.accent,
        descriptionColor: this.colors.muted,
        selectedDescriptionColor: this.colors.text,
        focusedBackgroundColor: this.colors.panel,
        backgroundColor: this.colors.panel,
      });
      select.on(
        SelectRenderableEvents.SELECTION_CHANGED,
        (_index: number, option: SelectOption | null) => {
          this.setOption(field.name, option?.value as GeneratorValue | undefined);
        },
      );
      container.add(select);
      this.focusables.push(select);
      return container;
    }

    const inputBox = panel(this.renderer, {
      id: `option-box-${field.name}`,
      height: 3,
      width: "100%",
    });
    const input = new InputRenderable(this.renderer, {
      id: `option-${field.name}`,
      width: "100%",
      value: formatInputValue(this.values[field.name]),
      placeholder: isMultiselect ? "Comma-separated values" : field.description || field.name,
      textColor: this.colors.text,
      cursorColor: this.colors.accent,
      backgroundColor: this.colors.panel,
      focusedBackgroundColor: this.colors.panel,
    });
    input.on(InputRenderableEvents.INPUT, (value: string) => {
      this.setOption(field.name, coerceInputValue(value, field.property));
    });
    inputBox.add(input);
    container.add(inputBox);
    this.focusables.push(input);
    return container;
  }

  private createMultiselectField(
    container: BoxRenderable,
    field: GeneratorField,
    choices: GeneratorChoice[],
  ): BoxRenderable {
    const selectedValues = (): GeneratorValue[] => {
      const currentValue = this.values[field.name];
      return Array.isArray(currentValue) ? currentValue : [];
    };
    const choiceOptions = (): SelectOption[] =>
      choices.map((choice) => ({
        name: `${selectedValues().some((value) => valuesEqual(value, choice.value)) ? "[x]" : "[ ]"} ${choice.label}`,
        description: choice.description,
        value: choice.value,
      }));
    const showDescription = choices.some((choice) => choice.description.length > 0);
    const requiredRows = choices.length * (showDescription ? 2 : 1);
    const height = Math.min(9, Math.max(3, requiredRows));
    container.height = container.height + height - 3;
    const select = new SelectRenderable(this.renderer, {
      id: `option-${field.name}`,
      width: "100%",
      height,
      options: choiceOptions(),
      showDescription,
      showScrollIndicator: requiredRows > height,
      wrapSelection: true,
      selectedBackgroundColor: this.colors.selection,
      selectedTextColor: this.colors.accent,
      descriptionColor: this.colors.muted,
      selectedDescriptionColor: this.colors.text,
      focusedBackgroundColor: this.colors.panel,
      backgroundColor: this.colors.panel,
      keyBindings: [{ name: "space", action: "select-current" }],
    });
    select.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (index: number, option: SelectOption | null) => {
        const value = option?.value as GeneratorValue | undefined;
        if (value === undefined) return;
        const current = selectedValues();
        const selected = current.some((item) => valuesEqual(item, value));
        const next = selected
          ? current.filter((item) => !valuesEqual(item, value))
          : [...current, value];
        this.setOption(field.name, next.length > 0 ? next : undefined);
        select.options = choiceOptions();
        select.setSelectedIndex(index);
      },
    );
    container.add(select);
    this.focusables.push(select);
    return container;
  }

  private setOption(name: string, value: GeneratorValue | undefined): void {
    this.values[name] = value;
    this.updateCommandPreview();
    this.scheduleDryRun();
  }

  private showConfirmation(): void {
    const generator = this.selectedGenerator;
    const validation = this.selectedValidator?.validate(this.values);
    if (!generator || !validation?.valid) {
      this.updateCommandPreview();
      return;
    }

    this.invalidatePendingRun();
    this.screen = "confirm";
    this.optionsScroll = undefined;
    this.focusables = [];
    this.replaceScreen(
      `Confirm ${generator.id}`,
      "Enter execute • Esc return to options",
    );

    const args = generatorArguments({ generator, values: this.values, dryRun: false });
    const confirmationPanel = panel(this.renderer, {
      id: "confirmation-panel",
      title: " Confirm workspace changes ",
      width: "100%",
      height: "100%",
    });
    this.previewText = new TextRenderable(this.renderer, {
      id: "confirmation-text",
      width: "100%",
      height: "100%",
      content:
        "Nx will now run without --dry-run and may create or modify files.\n\n" +
        displayCommand(this.options.invocation.displayExecutable, args) +
        "\n\nPress Enter to continue or Esc to cancel.",
      fg: this.colors.warning,
      wrapMode: "word",
      selectable: true,
    });
    confirmationPanel.add(this.previewText);
    this.requireScreenRoot().add(confirmationPanel);
  }

  private executeConfirmed(): void {
    const generator = this.selectedGenerator;
    if (!generator) return;

    this.screen = "result";
    this.mutationInProgress = true;
    this.replaceScreen(
      generator.id,
      "Running • Esc waits • Ctrl+C cancels and may leave partial changes",
    );
    const resultPanel = panel(this.renderer, {
      id: "execution-result-panel",
      title: " Generator execution ",
      width: "100%",
      height: "100%",
    });
    this.previewText = new TextRenderable(this.renderer, {
      id: "execution-result-text",
      width: "100%",
      height: "100%",
      content: "Starting generator…",
      fg: this.colors.muted,
      wrapMode: "word",
      selectable: true,
    });
    resultPanel.add(this.previewText);
    this.requireScreenRoot().add(resultPanel);
    void this.runGenerator(false);
  }

  private scheduleDryRun(): void {
    const version = this.invalidatePendingRun();
    if (!this.dryRunOnChange) return;
    const generator = this.selectedGenerator;
    if (!generator) return;

    const validation = this.selectedValidator?.validate(this.values);
    if (!validation?.valid) return;

    this.previewTimer = setTimeout(() => {
      void this.runGenerator(true, version);
    }, this.dryRunDelayMs);
  }

  private async runGenerator(dryRun: boolean, version = ++this.previewVersion): Promise<void> {
    const generator = this.selectedGenerator;
    if (!generator || !this.previewText) {
      if (!dryRun) this.finishMutation();
      return;
    }
    const validation = this.selectedValidator?.validate(this.values);
    if (!validation?.valid) {
      this.updateCommandPreview();
      if (!dryRun) this.finishMutation();
      return;
    }

    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = undefined;
    const args = generatorArguments({ generator, values: this.values, dryRun });
    this.previewText.fg = this.colors.muted;
    this.previewText.content = `${displayCommand(this.options.invocation.displayExecutable, args)}\n\nRunning…`;

    try {
      const result = await this.options.runner.run(args);
      if (version !== this.previewVersion || result.cancelled || !this.previewText) return;
      const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
      this.previewText.fg = result.exitCode === 0 ? this.colors.success : this.colors.error;
      this.previewText.content = `${displayCommand(this.options.invocation.displayExecutable, args)}\n\n${output || `Exited with code ${result.exitCode}`}`;
    } catch (error) {
      if (version !== this.previewVersion || !this.previewText) return;
      this.previewText.fg = this.colors.error;
      this.previewText.content = error instanceof Error ? error.message : String(error);
    } finally {
      if (!dryRun) this.finishMutation();
    }
  }

  private finishMutation(): void {
    this.mutationInProgress = false;
    if (!this.destroyed && this.screen === "result" && this.helpText) {
      this.helpText.content = "Esc return to options";
    }
  }

  private updateCommandPreview(): void {
    const generator = this.selectedGenerator;
    if (!generator || !this.previewText) return;
    const validation = this.selectedValidator?.validate(this.values);
    const args = generatorArguments({ generator, values: this.values, dryRun: true });
    const command = displayCommand(this.options.invocation.displayExecutable, args);
    this.previewText.fg = validation?.valid ? this.colors.text : this.colors.error;
    this.previewText.content = validation?.valid
      ? `${command}\n\n${this.dryRunOnChange ? "Dry-run queued…" : "Press Ctrl+R to preview."}`
      : `${command}\n\n${(validation?.messages ?? ["Unable to validate generator options."]).join("\n")}`;
  }

  private replaceScreen(title: string, help: string): void {
    if (this.screenRoot) {
      const previousApp = this.screenRoot.parent;
      if (previousApp) this.renderer.root.remove(previousApp);
      previousApp?.destroyRecursively();
    }

    const app = new BoxRenderable(this.renderer, {
      id: "nx-sprout",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: this.colors.background,
      padding: 1,
    });
    app.add(
      new TextRenderable(this.renderer, {
        id: "title",
        width: "100%",
        height: 2,
        content: `NX SPROUT  ${title}\n${this.options.workspace.root}`,
        fg: this.colors.accent,
        selectable: false,
      }),
    );

    const body = new BoxRenderable(this.renderer, {
      id: "screen-body",
      width: "100%",
      flexGrow: 1,
      flexDirection: "column",
      marginY: 1,
    });
    app.add(body);
    this.helpText = new TextRenderable(this.renderer, {
      id: "help",
      width: "100%",
      height: 1,
      content: help,
      fg: this.colors.muted,
      selectable: false,
    });
    app.add(this.helpText);
    this.renderer.root.add(app);
    this.screenRoot = body;
  }

  private requireScreenRoot(): BoxRenderable {
    if (!this.screenRoot) throw new Error("The TUI screen has not been initialized.");
    return this.screenRoot;
  }

  private generatorListTitle(count: number): string {
    const warningCount = this.options.warnings?.length ?? 0;
    const warningLabel = warningCount > 0 ? ` • ${warningCount} warning${warningCount === 1 ? "" : "s"}` : "";
    return ` Generators (${count})${warningLabel} `;
  }

  private generatorOptions(generators: GeneratorDescriptor[]): SelectOption[] {
    return generators.map((generator) => ({
      name: generator.id,
      description: generator.description,
      value: generator,
    }));
  }

  private onGlobalKey(key: KeyEvent): void {
    const isEnter = key.name === "return" || key.name === "linefeed";

    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      key.stopPropagation();
      this.destroy();
      return;
    }

    if (key.name === "tab") {
      key.preventDefault();
      key.stopPropagation();
      this.moveFocus(key.shift ? -1 : 1);
      return;
    }

    if (key.name === "escape") {
      key.preventDefault();
      if (this.screen === "result" && this.mutationInProgress) {
        key.stopPropagation();
        return;
      }
      if (this.screen === "options") {
        this.showGeneratorPicker();
      } else if ((this.screen === "confirm" || this.screen === "result") && this.selectedGenerator) {
        this.showOptions(this.selectedGenerator, false);
      } else {
        this.destroy();
      }
      return;
    }

    if (this.screen === "options" && key.ctrl && key.name === "r") {
      key.preventDefault();
      const version = this.invalidatePendingRun();
      void this.runGenerator(true, version);
      return;
    }

    if (this.screen === "options" && key.name === "f2") {
      key.preventDefault();
      this.showInternalOptions = !this.showInternalOptions;
      if (this.selectedGenerator) this.showOptions(this.selectedGenerator, false);
      return;
    }

    if (this.screen === "options" && key.ctrl && (key.name === "g" || isEnter)) {
      key.preventDefault();
      this.showConfirmation();
      return;
    }

    if (this.screen === "confirm" && isEnter) {
      key.preventDefault();
      this.executeConfirmed();
    }
  }

  private invalidatePendingRun(): number {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = undefined;
    this.options.runner.cancel();
    return ++this.previewVersion;
  }

  private moveFocus(delta: number): void {
    if (this.focusables.length === 0) return;
    this.focusIndex =
      (this.focusIndex + delta + this.focusables.length) % this.focusables.length;
    const focusable = this.focusables[this.focusIndex];
    focusable?.focus();
    if (focusable) this.optionsScroll?.scrollChildIntoView(focusable.id);
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function panel(
  renderer: CliRenderer,
  options: ConstructorParameters<typeof BoxRenderable>[1],
): BoxRenderable {
  return new BoxRenderable(renderer, {
    border: true,
    borderStyle: "rounded",
    borderColor: COLORS.border,
    focusedBorderColor: COLORS.borderFocused,
    backgroundColor: COLORS.panel,
    paddingX: 1,
    ...options,
  });
}
