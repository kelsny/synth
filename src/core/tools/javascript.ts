import { registeredGenerators } from "../../plugin/registered.js";
import {
    ArrayExpr,
    CallExpr,
    Expr,
    ExprVisitor,
    GroupingExpr,
    LiteralExpr,
    ObjectExpr,
    PropExpr,
    TupleExpr,
    UnaryExpr,
} from "../base/expr.js";
import { TokenType } from "../base/tokentype.js";
import type { createBaseProvider, createProviderExtension } from "../generators/generators.js";
import * as builtinGenerators from "../generators/index.js";

export class JSGenerator implements ExprVisitor<string> {
    #generators = Object.assign(builtinGenerators, registeredGenerators);

    constructor(/* more shit here */) {}

    generate(expr: Expr) {
        return expr.accept(this);
    }

    visitArrayExpr(expr: ArrayExpr): string {
        return `new ArrayNode(${expr.accept(this)})`;
    }

    visitCallExpr(expr: CallExpr): string {
        const generator = this.#generators[expr.identifier.lexeme];

        if (generator.isModifier)
            throw new Error(`Synthesizer should not have to generate a node for a single call expression.`);

        return generator.compile(
            Object.fromEntries([...expr.raw.entries()].map(([k, v]) => [k, (v as LiteralExpr).value])) as any,
        );
    }

    visitLiteralExpr(expr: LiteralExpr): string {
        if (expr.value instanceof RegExp)
            return this.#generators.string.compile({ boxed: true }, [
                this.#generators.regex.compile({
                    pattern: expr.value.source,
                    flags: "",
                }),
            ]);

        return `new LiteralNode(${typeof expr.value === "undefined" ? "undefined" : JSON.stringify(expr.value)})`;
    }

    visitGroupingExpr(expr: GroupingExpr): string {
        if (expr.expr.length === 1) {
            const provider = expr.expr[0];

            return provider.accept(this);
        }

        const validators = [] as CallExpr[];

        expr.expr.forEach((e) => {
            if (e instanceof CallExpr) {
                validators.push(e);
            }

            // ...
        });

        const index = validators.findIndex((v) => !this.#generators[v.identifier.lexeme].isModifier)!;

        // Isolate provider and generate it first
        const [provider] = validators.splice(index, 1);

        const node = (this.#generators[provider.identifier.lexeme] as ReturnType<typeof createBaseProvider>).compile(
            Object.fromEntries([...provider.raw.entries()].map(([k, v]) => [k, (v as LiteralExpr).value])) as any,
            validators.map((v) =>
                (this.#generators[v.identifier.lexeme] as ReturnType<typeof createProviderExtension>).compile(
                    Object.fromEntries([...v.raw.entries()].map(([k, v]) => [k, (v as LiteralExpr).value])) as any,
                ),
            ),
        );

        return node;
    }

    visitObjectExpr(expr: ObjectExpr): string {
        return `new ObjectNode([${expr.props
            .map(
                (p) =>
                    `[${p.name instanceof RegExp ? `/${p.name.source}/` : JSON.stringify(p.name)}, ${p.value.accept(
                        this,
                    )}, ${p.optional}]`,
            )
            .join(", ")}])`;
    }

    visitPropExpr(expr: PropExpr): string {
        return expr.value.accept(this);
    }

    visitTupleExpr(expr: TupleExpr): string {
        return `new TupleNode([${expr.elements.map((e) => e.accept(this)).join(", ")}])`;
    }

    visitUnaryExpr(expr: UnaryExpr): string {
        if (expr.operator.type === TokenType.Minus)
            throw new Error("No negations should be left after the resolution step.");

        throw new Error("Unknown unary operator received.");
    }
}
