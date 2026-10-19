import { Link } from "react-router-dom";
import PageHeading from "../components/PageHeading.jsx";

export default function NotFound() {
  return (
    <>
      <PageHeading
        title="Off the grid"
        description="This page doesn’t exist. Your workspace is one click away."
      />
      <Link className="button" to="/">
        Back to dashboard
      </Link>
    </>
  );
}
