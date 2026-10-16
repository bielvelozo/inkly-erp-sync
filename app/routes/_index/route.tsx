import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Inkly ERP Sync</h1>
        <p className={styles.text}>
          Sends every new Shopify order to the ERP and brings the tracking
          number back to the order.
        </p>
        {showForm && (
          <Form className={styles.form} method="post">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>{errors?.shop ?? "e.g: my-shop-domain.myshopify.com"}</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Orders to the ERP</strong>. Line items, totals and
            personalization leave Shopify the moment the order is created, with
            no customer personal data.
          </li>
          <li>
            <strong>Nothing lost</strong>. When the ERP is down the order is
            kept with the reason and sent again, never twice.
          </li>
          <li>
            <strong>Tracking back</strong>. When the ERP ships, the order is
            fulfilled in Shopify with the tracking number.
          </li>
        </ul>
      </div>
    </div>
  );
}
