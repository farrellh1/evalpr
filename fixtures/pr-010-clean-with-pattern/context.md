This project uses the `Result<T, E>` pattern for all fallible operations. Public
functions must return `Result` rather than panic or unwrap. Errors are
propagated with the `?` operator. The `ok_or` / `ok_or_else` combinators are
preferred for converting `Option` to `Result`. Do not flag idiomatic use of `?`
or `ok_or` as error-handling boilerplate.
