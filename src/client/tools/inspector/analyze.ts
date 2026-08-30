import { parseScript, type ESTree } from "meriyah";

import { ENTER } from "#lib";
import type { Definition } from "#lib";

import type {
  GuardCondition,
  MachineDescription,
  StateDescription,
  TransitionBranch,
  TransitionDescription,
} from "./types.js";

const PARSE_OPTIONS = { ranges: true } as const;

export function analyzeDefinition(
  definition: Definition<any, any, any>,
): MachineDescription {
  const states: Record<string, StateDescription> = {};
  for (const stateType of Object.keys(definition)) {
    const stateDefinition = definition[stateType];
    if (stateDefinition === undefined) continue;
    states[stateType] = analyzeState(stateType, stateDefinition);
  }
  return { states };
}

function analyzeState(
  stateType: string,
  stateDefinition: Definition<any, any, any>[string],
): StateDescription {
  const hasEnter = ENTER in stateDefinition;
  const eventTypes = Object.keys(stateDefinition);
  const transitions: TransitionDescription[] = [];
  let parseError: string | undefined;

  for (const eventType of eventTypes) {
    const handler = (stateDefinition as Record<string, unknown>)[eventType];
    if (typeof handler !== "function") continue;

    const result = analyzeHandler(handler);
    if (result.error !== undefined) {
      parseError = parseError ?? result.error;
      transitions.push({
        branches: [
          {
            guards: [],
            kind: "unknown",
            returnSource: `(parse error: ${result.error})`,
            targetStateType: null,
          },
        ],
        eventType,
      });
      continue;
    }
    transitions.push({ branches: result.branches, eventType });
  }

  return {
    eventTypes,
    hasEnter,
    transitions,
    type: stateType,
    ...(parseError !== undefined ? { parseError } : {}),
  };
}

type AnalyzeHandlerResult =
  | { error?: undefined; branches: TransitionBranch[] }
  | { error: string; branches?: undefined };

export function analyzeHandler(handler: Function): AnalyzeHandlerResult {
  const rawSource = handler.toString();
  if (rawSource.includes("[native code]")) {
    return { error: "native or bound function" };
  }

  const parsed = parseHandlerSource(rawSource);
  if (parsed === null) {
    return { error: "unparseable handler" };
  }
  const { fn, source } = parsed;
  const body = fn.body;
  if (body === null || body === undefined) {
    return { error: "empty function body" };
  }
  if (body.type === "BlockStatement") {
    return { branches: walkStatements(body.body, [], source) };
  }
  return { branches: walkReturnArgument(body as ESTree.Expression, [], source) };
}

type ParsedHandler = {
  fn: ESTree.FunctionExpression | ESTree.ArrowFunctionExpression;
  source: string;
};

function parseHandlerSource(rawSource: string): ParsedHandler | null {
  const source = rawSource.trimStart();

  // Try parsing as an expression (arrow function, function expression).
  try {
    const wrapped = `(${source})`;
    const program = parseScript(wrapped, PARSE_OPTIONS);
    const stmt = program.body[0];
    if (stmt?.type === "ExpressionStatement") {
      const expr = stmt.expression;
      if (
        expr.type === "ArrowFunctionExpression" ||
        expr.type === "FunctionExpression"
      ) {
        return { fn: expr, source: wrapped };
      }
    }
  } catch {
    // fall through to method-shorthand attempt
  }

  // Try parsing as method shorthand inside an object literal.
  try {
    const wrapped = `({${source}})`;
    const program = parseScript(wrapped, PARSE_OPTIONS);
    const stmt = program.body[0];
    if (
      stmt?.type === "ExpressionStatement" &&
      stmt.expression.type === "ObjectExpression"
    ) {
      const property = stmt.expression.properties[0];
      if (
        property?.type === "Property" &&
        (property.value.type === "FunctionExpression" ||
          property.value.type === "ArrowFunctionExpression")
      ) {
        return { fn: property.value, source: wrapped };
      }
    }
  } catch {
    // fall through
  }

  return null;
}

function walkStatements(
  statements: ESTree.Statement[],
  guards: GuardCondition[],
  source: string,
): TransitionBranch[] {
  const branches: TransitionBranch[] = [];
  let currentGuards = guards;
  for (const statement of statements) {
    if (statement.type === "ReturnStatement") {
      branches.push(
        ...walkReturnArgument(
          statement.argument ?? null,
          currentGuards,
          source,
        ),
      );
      return branches;
    }
    if (statement.type === "IfStatement") {
      const testGuard = extractGuard(statement.test, source, false);
      const consequentStatements = statementsOf(statement.consequent);
      branches.push(
        ...walkStatements(
          consequentStatements,
          [...currentGuards, testGuard],
          source,
        ),
      );
      const consequentAlwaysReturns = branchTerminatesInReturn(
        statement.consequent,
      );
      if (statement.alternate) {
        const alternateStatements = statementsOf(statement.alternate);
        branches.push(
          ...walkStatements(
            alternateStatements,
            [...currentGuards, invertGuard(testGuard)],
            source,
          ),
        );
        if (
          consequentAlwaysReturns &&
          branchTerminatesInReturn(statement.alternate)
        ) {
          return branches;
        }
      } else if (consequentAlwaysReturns) {
        currentGuards = [...currentGuards, invertGuard(testGuard)];
      }
      continue;
    }
    if (statement.type === "SwitchStatement") {
      const discriminantSource = sliceSource(statement.discriminant, source);
      let seenDefault = false;
      const negativeGuards: GuardCondition[] = [];
      for (const switchCase of statement.cases) {
        if (switchCase.test) {
          const caseValueSource = sliceSource(switchCase.test, source);
          const caseGuard: GuardCondition = {
            negated: false,
            source: `${discriminantSource} === ${caseValueSource}`,
          };
          branches.push(
            ...walkStatements(
              switchCase.consequent,
              [...currentGuards, caseGuard],
              source,
            ),
          );
          negativeGuards.push(invertGuard(caseGuard));
        } else {
          seenDefault = true;
          branches.push(
            ...walkStatements(
              switchCase.consequent,
              [...currentGuards, ...negativeGuards],
              source,
            ),
          );
        }
      }
      if (seenDefault) return branches;
      currentGuards = [...currentGuards, ...negativeGuards];
      continue;
    }
    if (statement.type === "BlockStatement") {
      const nested = walkStatements(statement.body, currentGuards, source);
      if (nested.length > 0) {
        branches.push(...nested);
        if (statements.indexOf(statement) === statements.length - 1) {
          return branches;
        }
      }
      continue;
    }
    // Skip variable declarations, expression statements, etc. They don't
    // affect the return paths (aside from side effects we don't model).
  }
  if (branches.length === 0) {
    branches.push({
      guards: currentGuards,
      kind: "unknown",
      returnSource: "(missing return)",
      targetStateType: null,
    });
  }
  return branches;
}

function walkReturnArgument(
  argument: ESTree.Expression | null,
  guards: GuardCondition[],
  source: string,
): TransitionBranch[] {
  if (argument === null) {
    return [
      {
        guards,
        kind: "unknown",
        returnSource: "(missing return value)",
        targetStateType: null,
      },
    ];
  }
  if (argument.type === "ConditionalExpression") {
    const testGuard = extractGuard(argument.test, source, false);
    return [
      ...walkReturnArgument(
        argument.consequent,
        [...guards, testGuard],
        source,
      ),
      ...walkReturnArgument(
        argument.alternate,
        [...guards, invertGuard(testGuard)],
        source,
      ),
    ];
  }
  if (argument.type === "ObjectExpression") {
    const typeProperty = findTypeProperty(argument);
    if (
      typeProperty !== null &&
      typeProperty.value.type === "Literal" &&
      typeof typeProperty.value.value === "string"
    ) {
      return [
        {
          guards,
          kind: "transition",
          returnSource: sliceSource(argument, source),
          targetStateType: typeProperty.value.value,
        },
      ];
    }
    return [
      {
        guards,
        kind: "unknown",
        returnSource: sliceSource(argument, source),
        targetStateType: null,
      },
    ];
  }
  if (argument.type === "Identifier" && argument.name === "state") {
    return [
      {
        guards,
        kind: "self",
        returnSource: "state",
        targetStateType: null,
      },
    ];
  }
  return [
    {
      guards,
      kind: "unknown",
      returnSource: sliceSource(argument, source),
      targetStateType: null,
    },
  ];
}

function findTypeProperty(
  object: ESTree.ObjectExpression,
): ESTree.Property | null {
  for (const property of object.properties) {
    if (property.type !== "Property") continue;
    if (property.computed) continue;
    const key = property.key;
    if (key.type === "Identifier" && key.name === "type") return property;
    if (key.type === "Literal" && key.value === "type") return property;
  }
  return null;
}

function extractGuard(
  expression: ESTree.Expression,
  source: string,
  negated: boolean,
): GuardCondition {
  return { negated, source: sliceSource(expression, source) };
}

function invertGuard(guard: GuardCondition): GuardCondition {
  return { negated: !guard.negated, source: guard.source };
}

function statementsOf(node: ESTree.Statement): ESTree.Statement[] {
  if (node.type === "BlockStatement") return node.body;
  return [node];
}

function branchTerminatesInReturn(node: ESTree.Statement): boolean {
  if (node.type === "ReturnStatement") return true;
  if (node.type === "BlockStatement") {
    const last = node.body[node.body.length - 1];
    return last !== undefined && branchTerminatesInReturn(last);
  }
  if (node.type === "IfStatement") {
    return (
      node.alternate !== undefined &&
      node.alternate !== null &&
      branchTerminatesInReturn(node.consequent) &&
      branchTerminatesInReturn(node.alternate)
    );
  }
  return false;
}

function sliceSource(node: ESTree.Node, source: string): string {
  const start = (node as { start?: number }).start;
  const end = (node as { end?: number }).end;
  if (typeof start !== "number" || typeof end !== "number") {
    return "(unavailable)";
  }
  return source.slice(start, end);
}
