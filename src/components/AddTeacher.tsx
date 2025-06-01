import styles from "../css/AddTeacher.module.css";
import Close from "../assets/close.png";

type Props = {
  handleAddTeacher: void;
};
const AddTeacher = ({ handleAddTeacher }: Props) => {
  return (
    <div className={styles.AddTeacher}>
      <div className={styles.Head_add}>
        <h1>Add Teacher</h1>
        <img onClick={handleAddTeacher} src={Close} />
      </div>
      <form action="">
        <div>
          <label htmlFor="">First Name:</label>
          <input type="text" placeholder="Enter first name.." />
        </div>

        <div>
          <label htmlFor="">Last Name:</label>
          <input type="text" placeholder="Enter last name.." />
        </div>

        <div>
          <label htmlFor="">Last Name:</label>
          <input type="email" placeholder="Enter email address.." />
        </div>

        <div>
          <label htmlFor="">Last Name:</label>
          <input type="password" placeholder="Enter password.." />
        </div>
        <button onClick={handleAddTeacher}>Submit</button>
      </form>
    </div>
  );
};

export default AddTeacher;
